import type { Express, Request, Response } from 'express';
import { parseSaveMokinaBusinessRequest, type MokinaBusinessKind } from '@open-design/contracts';
import { BusinessDocumentError, readBusinessDocument, saveBusinessDocument } from '../../mokina/business-documents.js';

type Dependencies = {
  projectsRoot: string;
  getProject: (id: string) => { id: string; metadata?: unknown } | null | undefined;
  authorizeProjectRequest: (req: Request, res: Response, id: string, options: { mode: 'read' } | { mode: 'write'; capability: 'writeFiles' }) => Promise<unknown>;
};
export function registerMokinaBusinessRoutes(app: Express, deps: Dependencies) {
  const report = (res: Response, error: unknown) => {
    const code = error instanceof BusinessDocumentError ? error.code : (error as NodeJS.ErrnoException)?.code;
    const status = code === 'MOKINA_BUSINESS_CONFLICT' ? 409 : code === 'MOKINA_BUSINESS_UNRECOGNIZED' ? 422 : code === 'MOKINA_BUSINESS_SOURCE_INVALID' ? 400 : code === 'ENOENT' ? 404 : 500;
    res.status(status).json({ error: { code: code ?? 'MOKINA_BUSINESS_UNAVAILABLE', message: error instanceof Error ? error.message : '无法读取或保存；请保留草稿并核对当前成果。' } });
  };
  app.get('/api/projects/:id/mokina/business/:kind', async (req, res) => {
    const project = deps.getProject(String(req.params.id));
    if (!project) { res.status(404).json({ error: { code: 'PROJECT_NOT_FOUND', message: 'project not found' } }); return; }
    if (!await deps.authorizeProjectRequest(req, res, project.id, { mode: 'read' })) return;
    if (req.params.kind !== 'background' && req.params.kind !== 'brief') { res.status(400).json({ error: { message: 'Invalid kind' } }); return; }
    if (req.query.versionId !== undefined && (typeof req.query.versionId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(req.query.versionId))) { res.status(400).json({ error: { message: 'Invalid versionId' } }); return; }
    try { res.json({ result: await readBusinessDocument({ ...deps, projectId: project.id, metadata: project.metadata,
      kind: req.params.kind as MokinaBusinessKind, ...(typeof req.query.versionId === 'string' ? { versionId: req.query.versionId } : {}) }) }); }
    catch (error) { report(res, error); }
  });
  app.post('/api/projects/:id/mokina/business/:kind', async (req, res) => {
    const project = deps.getProject(String(req.params.id));
    if (!project) { res.status(404).json({ error: { code: 'PROJECT_NOT_FOUND', message: 'project not found' } }); return; }
    if (!await deps.authorizeProjectRequest(req, res, project.id, { mode: 'write', capability: 'writeFiles' })) return;
    let request;
    try { request = parseSaveMokinaBusinessRequest(req.body); if (request.body.kind !== req.params.kind) throw new Error('Document kind mismatch'); }
    catch (error) { res.status(400).json({ error: { code: 'BAD_REQUEST', message: error instanceof Error ? error.message : 'Invalid request' } }); return; }
    try {
      let sourceMetadata: unknown;
      if (request.body.kind === 'brief' && request.body.background) {
        // A committed copy belongs to the destination. Reconciliation does
        // not copy its source again, even after that source was removed.
        const current = await readBusinessDocument({ projectsRoot: deps.projectsRoot, projectId: project.id, metadata: project.metadata, kind: 'brief' });
        if (current?.document.operationId !== request.operationId) {
          const source = deps.getProject(request.body.background.projectId);
          if (!source) { res.status(404).json({ error: { code: 'PROJECT_NOT_FOUND', message: 'source project not found' } }); return; }
          if (!await deps.authorizeProjectRequest(req, res, source.id, { mode: 'read' })) return;
          sourceMetadata = source.metadata;
        }
      }
      res.json({ result: await saveBusinessDocument({ ...deps, projectId: project.id, metadata: project.metadata, sourceMetadata, request }) });
    }
    catch (error) { report(res, error); }
  });
}
