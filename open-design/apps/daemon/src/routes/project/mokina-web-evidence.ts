import type { Express, Request, Response } from 'express';
import { mokinaWebOperationId, parseCaptureMokinaWebEvidenceRequest } from '@open-design/contracts';
import { captureWebEvidence, readCapturedWebEvidence } from '../../mokina/web-evidence.js';
import { WebEvidenceError } from '../../mokina/public-web-page.js';

export function registerMokinaWebEvidenceRoutes(app: Express, deps: {
  projectsRoot: string;
  getProject: (id: string) => { id: string; metadata?: unknown } | null | undefined;
  authorizeProjectRequest: (req: Request, res: Response, id: string, options: { mode: 'read' } | { mode: 'write'; capability: 'writeFiles' }) => Promise<unknown>;
}) {
  const report = (res: Response, error: unknown) => {
    const code = (error as NodeJS.ErrnoException).code;
    const status = error instanceof WebEvidenceError ? error.status : code === 'VERSION_MANIFEST_INVALID' ? 409 : 500;
    res.status(status).json({ error: { code: error instanceof WebEvidenceError ? error.code : 'WEB_CAPTURE_UNAVAILABLE',
      message: error instanceof Error ? error.message : 'Web evidence is unavailable; query the same operation before retrying.' } });
  };
  app.get('/api/projects/:id/mokina/web-evidence/:operationId', async (req, res) => {
    const project = deps.getProject(String(req.params.id));
    if (!project) { res.status(404).json({ error: { code: 'PROJECT_NOT_FOUND' } }); return; }
    if (!await deps.authorizeProjectRequest(req, res, project.id, { mode: 'read' })) return;
    let operationId;
    try { operationId = mokinaWebOperationId(req.params.operationId); }
    catch (error) { res.status(400).json({ error: { code: 'BAD_REQUEST', message: String(error) } }); return; }
    try { res.json({ result: await readCapturedWebEvidence({ ...deps, projectId: project.id, metadata: project.metadata }, operationId) }); }
    catch (error) { report(res, error); }
  });
  app.post('/api/projects/:id/mokina/web-evidence', async (req, res) => {
    const project = deps.getProject(String(req.params.id));
    if (!project) { res.status(404).json({ error: { code: 'PROJECT_NOT_FOUND' } }); return; }
    if (!await deps.authorizeProjectRequest(req, res, project.id, { mode: 'write', capability: 'writeFiles' })) return;
    let request;
    try { request = parseCaptureMokinaWebEvidenceRequest(req.body); }
    catch (error) { res.status(400).json({ error: { code: 'BAD_REQUEST', message: String(error) } }); return; }
    const controller = new AbortController();
    const onClose = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', onClose);
    try { res.json({ result: await captureWebEvidence({ ...deps, projectId: project.id, metadata: project.metadata }, request, controller.signal) }); }
    catch (error) { if (!res.destroyed) report(res, error); }
    finally { res.removeListener('close', onClose); }
  });
}
