import type { Express, Request, Response } from 'express';
import { readMokinaMaterial } from '../../mokina/materials.js';
import { WebEvidenceError } from '../../mokina/public-web-page.js';
import { readCapturedWebEvidence } from '../../mokina/web-evidence.js';
import { readProjectFile } from '../../projects.js';

const capturedName = /^evidence\/web-([A-Za-z0-9][A-Za-z0-9_-]{0,127})\.md$/u;

export function registerProjectMaterialRoute(app: Express, deps: {
  projectsRoot: string;
  getProject: (id: string) => { id: string; metadata?: unknown } | null | undefined;
  authorizeProjectRequest: (req: Request, res: Response, id: string, options: { mode: 'read' }) => Promise<unknown>;
  sendApiError: (res: Response, status: number,
    code: 'PROJECT_NOT_FOUND' | 'FILE_NOT_FOUND' | 'BAD_REQUEST', message: string) => unknown;
}) {
  app.get('/api/projects/:id/files/:name/material', async (req, res) => {
    try {
      const project = deps.getProject(String(req.params.id));
      if (!project) return void deps.sendApiError(res, 404, 'PROJECT_NOT_FOUND', 'project not found');
      if (!await deps.authorizeProjectRequest(req, res, project.id, { mode: 'read' })) return;
      const file = await readProjectFile(deps.projectsRoot, String(req.params.id), String(req.params.name), project.metadata);
      const material = await readMokinaMaterial(file.name, file.buffer);
      const captureId = file.name.match(capturedName)?.[1];
      let captured: Awaited<ReturnType<typeof readCapturedWebEvidence>> = null;
      if (captureId) {
        try {
          captured = await readCapturedWebEvidence({ projectsRoot: deps.projectsRoot, projectId: project.id, metadata: project.metadata }, captureId);
        } catch (error) {
          // Known-untrusted bytes stay readable as a plain material without the
          // trusted receipt; only capture metadata failures degrade — everything
          // else keeps its specific status instead of collapsing into 400.
          // The manifest reader preserves JSON.parse's SyntaxError as well as
          // its typed schema errors. Neither grants this file a source identity.
          const invalidManifest = error instanceof SyntaxError
            || (error as NodeJS.ErrnoException | null)?.code === 'VERSION_MANIFEST_INVALID';
          if (!invalidManifest && (!(error instanceof WebEvidenceError)
            || !['WEB_CAPTURE_INTEGRITY', 'WEB_CAPTURE_CONFLICT'].includes(error.code))) throw error;
        }
      }
      return void res.json(captured?.contentDigest === material.contentDigest ? captured.material : material);
    } catch (error) {
      if (error instanceof WebEvidenceError) {
        return void res.status(error.status).json({ error: { code: error.code, message: error.message } });
      }
      const status = (error as NodeJS.ErrnoException)?.code === 'ENOENT' ? 404 : 400;
      return void deps.sendApiError(res, status, status === 404 ? 'FILE_NOT_FOUND' : 'BAD_REQUEST',
        (error as Error)?.message || 'material extraction failed');
    }
  });
}
