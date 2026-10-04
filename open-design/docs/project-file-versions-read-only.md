# Read-only HTML version metadata

`GET /api/projects/:projectId/files/:fileName/versions?readOnly=true` lists existing HTML history without creating a first version for a legacy working file. Its response is the existing `ProjectFileVersionsResponse`; an empty `versions` array is valid. Workspace authorization and relative-path validation are unchanged. `ProjectFileVersionsQuery.readOnly` is optional in `@open-design/contracts`.

```sh
curl "$OD_DAEMON_URL/api/projects/$PROJECT_ID/files/plan.html/versions?readOnly=true"
od files versions "$PROJECT_ID" plan.html --read-only --json --daemon-url "$OD_DAEMON_URL"
```

An existing history-free HTML responds without writing a baseline snapshot:

```json
{ "file": { "name": "plan.html", "kind": "html", "size": 42 }, "versions": [] }
```

For a workspace project, supply its original identity (the daemon retains its native authorization checks):

```sh
curl -H "x-od-workspace-id: $WORKSPACE_ID" -H "x-od-workspace-member-id: $MEMBER_ID" \
  "$OD_DAEMON_URL/api/projects/$PROJECT_ID/files/plan.html/versions?readOnly=true"
od files versions "$PROJECT_ID" plan.html --read-only --workspace "$WORKSPACE_ID" \
  --workspace-member "$MEMBER_ID" --json --daemon-url "$OD_DAEMON_URL"
```

Web callers continue to use their complete `workspaceProjectHeaders` context; the CLI accepts its existing explicit workspace/member flags. A failed or unauthorized read is not an empty history. Mokina summaries and default-entry resolution use this option; they do not adopt candidates or alter `current`.

Omitting the option preserves the existing behavior: a normal versions GET may initialize the first snapshot of an unversioned HTML file. Explicit version creation, candidate adoption, restore, and content reads retain their existing endpoints.
