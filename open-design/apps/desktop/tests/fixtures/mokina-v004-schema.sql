-- Schema-only fixture generated from daemon openDatabase at 98851a97. No user data.
CREATE TABLE agent_sessions (
      conversation_id TEXT NOT NULL,
      agent_id        TEXT NOT NULL,
      session_id      TEXT NOT NULL,
      stable_prompt_hash TEXT,
      -- Per-section digests of the stable prefix inputs behind
      -- stable_prompt_hash, as JSON (see prompts/stable-sections.ts). Purely
      -- diagnostic: when the hash moves, diffing this against the current turn
      -- names WHICH input drifted. Never gates a re-send -- stable_prompt_hash
      -- stays the only source of truth for that.
      stable_prompt_sections TEXT,
      -- Resume identity guard: the session is only safe to resume when the
      -- conversation has not changed shape under it. model/cwd are the runtime
      -- identity the upstream session was created with; a change forces a fresh
      -- session. last_message_id is the assistant message this session produced
      -- on its last turn -- if it is no longer the latest completed assistant
      -- turn (another agent ran in between, or it was edited away), the session
      -- is behind and we reseed the full transcript.
      model           TEXT,
      cwd             TEXT,
      last_message_id TEXT,
      -- Last provider-reported effective input usage for this exact session.
      -- Observability only: never used to admit, reject, compact, or roll over.
      last_input_tokens INTEGER,
      updated_at      INTEGER NOT NULL,
      PRIMARY KEY (conversation_id, agent_id),
      FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

CREATE TABLE amr_terminal_report_outbox (
      run_id TEXT PRIMARY KEY,
      outcome TEXT NOT NULL CHECK (outcome IN ('failed', 'canceled')),
      terminal_at INTEGER NOT NULL
    , terminal_at_iso TEXT, state TEXT NOT NULL DEFAULT 'pending', attempt_count INTEGER NOT NULL DEFAULT 0, next_attempt_at INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 0, lease_until INTEGER, last_error_code TEXT, last_error TEXT, receipt TEXT, created_at INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT 0);

CREATE TABLE applied_plugin_snapshots (
      id                       TEXT PRIMARY KEY,
      project_id               TEXT NOT NULL,
      conversation_id          TEXT,
      run_id                   TEXT,
      plugin_id                TEXT NOT NULL,
      plugin_spec_version      TEXT NOT NULL DEFAULT '1.0.0',
      plugin_version           TEXT NOT NULL,
      manifest_source_digest   TEXT NOT NULL,
      strategy_json            TEXT,
      source_marketplace_id    TEXT,
      source_marketplace_entry_name TEXT,
      source_marketplace_entry_version TEXT,
      marketplace_trust        TEXT,
      resolved_source          TEXT,
      resolved_ref             TEXT,
      archive_integrity        TEXT,
      pinned_ref               TEXT,
      task_kind                TEXT NOT NULL,
      inputs_json              TEXT NOT NULL,
      resolved_context_json    TEXT NOT NULL,
      craft_requires_json      TEXT NOT NULL DEFAULT '[]',
      pipeline_json            TEXT,
      genui_surfaces_json      TEXT NOT NULL DEFAULT '[]',
      capabilities_granted     TEXT NOT NULL,
      capabilities_required    TEXT NOT NULL DEFAULT '[]',
      assets_staged_json       TEXT NOT NULL,
      connectors_required_json TEXT NOT NULL DEFAULT '[]',
      connectors_resolved_json TEXT NOT NULL DEFAULT '[]',
      mcp_servers_json         TEXT NOT NULL DEFAULT '[]',
      plugin_title             TEXT,
      plugin_description       TEXT,
      query_text               TEXT,
      status                   TEXT NOT NULL DEFAULT 'fresh',
      applied_at               INTEGER NOT NULL,
      expires_at               INTEGER,
      FOREIGN KEY (project_id)      REFERENCES projects(id)      ON DELETE CASCADE,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL
    );

CREATE TABLE chat_artifact_blobs (
      digest TEXT PRIMARY KEY,
      storage_key TEXT NOT NULL,
      byte_size INTEGER NOT NULL,
      mime TEXT,
      created_at INTEGER NOT NULL,
      last_verified_at INTEGER
    );

CREATE TABLE chat_artifact_snapshots (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      workspace_artifact_id TEXT,
      source_path_at_capture TEXT NOT NULL,
      kind TEXT NOT NULL,
      mime TEXT,
      content_digest TEXT,
      thumbnail_digest TEXT,
      source_size INTEGER,
      source_mtime INTEGER,
      expected_size INTEGER,
      expected_mtime INTEGER,
      expected_digest TEXT,
      temp_key TEXT,
      run_id TEXT,
      media_task_id TEXT,
      capture_state TEXT NOT NULL CHECK (capture_state IN
        ('pending','ready','failed','orphaned')),
      failure_code TEXT,
      created_at INTEGER NOT NULL,
      ready_at INTEGER,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY(workspace_artifact_id)
        REFERENCES workspace_artifacts(id) ON DELETE SET NULL
    );

CREATE TABLE collab_sync_snapshots (
      face TEXT NOT NULL,
      account_id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      digest_token TEXT NOT NULL,
      snapshot_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (face, account_id, workspace_id)
    );

CREATE TABLE comment_relay_outbox (
      workspace_id TEXT NOT NULL,
      workspace_member_id TEXT NOT NULL,
      team_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      comment_id TEXT NOT NULL,
      expected_owner_member_id TEXT,
      payload_json TEXT NOT NULL,
      revision INTEGER NOT NULL DEFAULT 1,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      next_attempt_at INTEGER NOT NULL,
      last_error TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (workspace_id, workspace_member_id, project_id, comment_id)
    );

CREATE TABLE conversations (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT,
      session_mode TEXT NOT NULL DEFAULT 'design',
      intent_signals_json TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL, applied_plugin_snapshot_id TEXT,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

CREATE TABLE critique_runs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      conversation_id TEXT,
      artifact_path TEXT,
      status TEXT NOT NULL CHECK (status IN
        ('shipped','below_threshold','timed_out','interrupted','degraded','failed','legacy','running')),
      score REAL,
      rounds_json TEXT NOT NULL DEFAULT '[]',
      transcript_path TEXT,
      protocol_version INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE SET NULL
    );

CREATE TABLE daemon_maintenance_passes (
      name TEXT PRIMARY KEY,
      completed_at INTEGER NOT NULL
    );

CREATE TABLE deployments (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      url TEXT NOT NULL,
      deployment_id TEXT,
      deployment_count INTEGER NOT NULL DEFAULT 1,
      target TEXT NOT NULL DEFAULT 'preview',
      status TEXT NOT NULL DEFAULT 'ready',
      status_message TEXT,
      reachable_at INTEGER,
      provider_metadata_json TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(project_id, file_name, provider_id),
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

CREATE TABLE genui_surfaces (
      id                    TEXT PRIMARY KEY,
      project_id            TEXT NOT NULL,
      conversation_id       TEXT,
      run_id                TEXT,
      plugin_snapshot_id    TEXT NOT NULL,
      surface_id            TEXT NOT NULL,
      kind                  TEXT NOT NULL,
      persist               TEXT NOT NULL,
      schema_digest         TEXT,
      value_json            TEXT,
      status                TEXT NOT NULL,
      responded_by          TEXT,
      requested_at          INTEGER NOT NULL,
      responded_at          INTEGER,
      expires_at            INTEGER,
      FOREIGN KEY (project_id)         REFERENCES projects(id)                  ON DELETE CASCADE,
      FOREIGN KEY (plugin_snapshot_id) REFERENCES applied_plugin_snapshots(id)  ON DELETE SET NULL
    );

CREATE TABLE installed_plugins (
      id                   TEXT PRIMARY KEY,
      title                TEXT NOT NULL,
      version              TEXT NOT NULL,
      source_kind          TEXT NOT NULL,
      source               TEXT NOT NULL,
      pinned_ref           TEXT,
      source_digest        TEXT,
      source_marketplace_id TEXT,
      source_marketplace_entry_name TEXT,
      source_marketplace_entry_version TEXT,
      marketplace_trust    TEXT,
      resolved_source      TEXT,
      resolved_ref         TEXT,
      manifest_digest      TEXT,
      archive_integrity    TEXT,
      trust                TEXT NOT NULL,
      capabilities_granted TEXT NOT NULL,
      manifest_json        TEXT NOT NULL,
      fs_path              TEXT NOT NULL,
      installed_at         INTEGER NOT NULL,
      updated_at           INTEGER NOT NULL
    , bundled_content_digest TEXT);

CREATE TABLE library_asset_sources (
      id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL,
      source_kind TEXT NOT NULL,
      project_id TEXT,
      conversation_id TEXT,
      run_id TEXT,
      design_system_id TEXT,
      rel_path TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(asset_id) REFERENCES library_assets(id) ON DELETE CASCADE
    );

CREATE TABLE library_assets (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      storage TEXT NOT NULL DEFAULT 'owned',
      source_url TEXT,
      source_title TEXT,
      source_domain TEXT,
      captured_at INTEGER NOT NULL,
      archived_date TEXT NOT NULL,
      file_path TEXT,
      origin_project_id TEXT,
      rel_path TEXT,
      mime TEXT,
      width INTEGER,
      height INTEGER,
      size INTEGER,
      content_hash TEXT NOT NULL,
      caption TEXT,
      ocr_text TEXT,
      palette_json TEXT,
      tags_json TEXT,
      metadata_json TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(content_hash)
    );

CREATE TABLE library_digests (
      date TEXT PRIMARY KEY,
      project_id TEXT,
      artifact_path TEXT,
      summary TEXT,
      created_at INTEGER NOT NULL
    );

CREATE TABLE library_embeddings (
      asset_id TEXT PRIMARY KEY,
      model TEXT NOT NULL,
      dim INTEGER NOT NULL,
      vector BLOB NOT NULL,
      indexed_text TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(asset_id) REFERENCES library_assets(id) ON DELETE CASCADE
    );

CREATE TABLE library_tasks (
      id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      progress_json TEXT NOT NULL DEFAULT '[]',
      error_json TEXT,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      FOREIGN KEY(asset_id) REFERENCES library_assets(id) ON DELETE CASCADE
    );

CREATE TABLE library_tokens (
      token_hash TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      extension_origin TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_used_at INTEGER NOT NULL
    );

CREATE TABLE media_tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      run_id TEXT,
      status TEXT NOT NULL CHECK (status IN
        ('queued','running','done','failed','interrupted')),
      surface TEXT,
      model TEXT,
      progress_json TEXT NOT NULL DEFAULT '[]',
      file_json TEXT,
      error_json TEXT,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

CREATE TABLE message_artifacts (
      message_id TEXT NOT NULL,
      ordinal INTEGER NOT NULL,
      id TEXT NOT NULL UNIQUE,
      snapshot_id TEXT,
      workspace_artifact_id TEXT,
      display_policy TEXT NOT NULL CHECK (display_policy IN
        ('latest_with_static_preview','immutable_snapshot')),
      -- No open_policy column, on purpose: every card opens the workspace's
      -- latest file, so workspace_artifact_id above IS the click target.
      -- See policy.ts for the ruling.
      label_at_capture TEXT NOT NULL,
      kind TEXT NOT NULL,
      html_version_id TEXT,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (message_id, ordinal),
      FOREIGN KEY(message_id) REFERENCES messages(id) ON DELETE CASCADE,
      FOREIGN KEY(snapshot_id)
        REFERENCES chat_artifact_snapshots(id) ON DELETE SET NULL,
      FOREIGN KEY(workspace_artifact_id)
        REFERENCES workspace_artifacts(id) ON DELETE SET NULL
    );

CREATE TABLE message_event_batches (
      id INTEGER PRIMARY KEY,
      message_id TEXT NOT NULL,
      events_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(message_id) REFERENCES messages(id) ON DELETE CASCADE
    );

CREATE TABLE messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      agent_id TEXT,
      agent_name TEXT,
      result_delivery_state TEXT,
      events_json TEXT,
      attachments_json TEXT,
      produced_files_json TEXT,
      trace_object_files_json TEXT,
      feedback_json TEXT,
      pre_turn_file_names_json TEXT,
      session_mode TEXT,
      run_context_json TEXT,
      task_analytics_json TEXT,
      applied_plugin_snapshot_json TEXT,
      telemetry_finalized_at INTEGER,
      started_at INTEGER,
      ended_at INTEGER,
      position INTEGER NOT NULL,
      created_at INTEGER NOT NULL, run_id TEXT, run_status TEXT, last_run_event_id TEXT, comment_attachments_json TEXT, forked_into_json TEXT, cancel_origin TEXT,
      FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

CREATE TABLE plugin_marketplaces (
      id            TEXT PRIMARY KEY,
      url           TEXT NOT NULL,
      spec_version  TEXT NOT NULL DEFAULT '1.0.0',
      version       TEXT NOT NULL DEFAULT '0.0.0',
      trust         TEXT NOT NULL,
      manifest_json TEXT NOT NULL,
      added_at      INTEGER NOT NULL,
      refreshed_at  INTEGER NOT NULL
    );

CREATE TABLE preview_comments (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      conversation_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      element_id TEXT NOT NULL,
      selector TEXT NOT NULL,
      label TEXT NOT NULL,
      text TEXT NOT NULL,
      position_json TEXT NOT NULL,
      html_hint TEXT NOT NULL,
      selection_kind TEXT,
      member_count INTEGER,
      pod_members_json TEXT,
      style_json TEXT,
      attachments_json TEXT,
      slide_index INTEGER,
      slide_key INTEGER NOT NULL DEFAULT -1,
      note TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      anchor_state TEXT,
      anchored_version INTEGER,
      author_member_id TEXT,
      last_good_position_json TEXT, pin_seq INTEGER, pin_seq_confirmed INTEGER NOT NULL DEFAULT 1, sort_key REAL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      skill_id TEXT,
      design_system_id TEXT,
      pending_prompt TEXT,
      metadata_json TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    , custom_instructions TEXT, applied_plugin_snapshot_id TEXT);

CREATE TABLE public_file_publications (
      resource_team_id TEXT NOT NULL,
      owner_member_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      url TEXT NOT NULL,
      slug TEXT NOT NULL,
      file_name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (resource_team_id, owner_member_id, project_id, file_path)
    );

CREATE TABLE routine_runs (
      id TEXT PRIMARY KEY,
      routine_id TEXT NOT NULL,
      trigger TEXT NOT NULL,
      status TEXT NOT NULL,
      project_id TEXT NOT NULL,
      conversation_id TEXT NOT NULL,
      agent_run_id TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      completed_at INTEGER,
      summary TEXT,
      error TEXT,
      error_code TEXT,
      FOREIGN KEY(routine_id) REFERENCES routines(id) ON DELETE CASCADE
    );

CREATE TABLE routine_schedule_claims (
      routine_id TEXT NOT NULL,
      slot_at INTEGER NOT NULL,
      claimed_at INTEGER NOT NULL,
      PRIMARY KEY(routine_id, slot_at),
      FOREIGN KEY(routine_id) REFERENCES routines(id) ON DELETE CASCADE
    );

CREATE TABLE routines (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      prompt TEXT NOT NULL,
      schedule_kind TEXT NOT NULL,
      schedule_value TEXT NOT NULL,
      schedule_json TEXT,
      project_mode TEXT NOT NULL,
      project_id TEXT,
      skill_id TEXT,
      agent_id TEXT,
      context_json TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

CREATE TABLE run_devloop_iterations (
      id                    TEXT PRIMARY KEY,
      run_id                TEXT NOT NULL,
      stage_id              TEXT NOT NULL,
      iteration             INTEGER NOT NULL,
      artifact_diff_summary TEXT,
      critique_summary      TEXT,
      tokens_used           INTEGER,
      ended_at              INTEGER NOT NULL
    );

CREATE TABLE skill_plugin_candidates (
      id                   TEXT PRIMARY KEY,
      project_id           TEXT NOT NULL,
      run_id               TEXT,
      conversation_id      TEXT,
      assistant_message_id TEXT,
      fingerprint          TEXT NOT NULL,
      status               TEXT NOT NULL DEFAULT 'active',
      title                TEXT NOT NULL,
      description          TEXT NOT NULL,
      confidence           REAL NOT NULL,
      source_refs_json     TEXT NOT NULL,
      provenance_json      TEXT NOT NULL,
      draft_path           TEXT,
      created_at           INTEGER NOT NULL,
      updated_at           INTEGER NOT NULL,
      dismissed_at         INTEGER,
      UNIQUE(project_id, fingerprint),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

CREATE TABLE strategy_task_executions (
      task_execution_id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL DEFAULT 1,
      revision INTEGER NOT NULL DEFAULT 0,
      project_id TEXT NOT NULL,
      conversation_id TEXT NOT NULL,
      snapshot_id TEXT NOT NULL,
      strategy_id TEXT NOT NULL,
      strategy_version TEXT NOT NULL,
      strategy_package_hash TEXT NOT NULL,
      selected_agent_id TEXT NOT NULL,
      route TEXT CHECK (route IN ('direct_edit', 'full_plan')),
      input_stage TEXT NOT NULL CHECK (
        input_stage IN ('request', 'clarification', 'contract_repair', 'production')
      ),
      outcome TEXT NOT NULL CHECK (
        outcome IN (
          'running', 'clarification_required', 'plan_ready',
          'completed', 'blocked', 'canceled'
        )
      ),
      execution_mode TEXT CHECK (execution_mode IN ('simple', 'complex')),
      execution_intent TEXT NOT NULL DEFAULT 'produce',
      plan_contract_json TEXT,
      plan_contract_hash TEXT,
      clarification_count INTEGER NOT NULL DEFAULT 0 CHECK (clarification_count BETWEEN 0 AND 1),
      plan_contract_repair_attempts INTEGER NOT NULL DEFAULT 0 CHECK (
        plan_contract_repair_attempts BETWEEN 0 AND 1
      ),
      initial_run_id TEXT NOT NULL,
      latest_run_id TEXT NOT NULL,
      prompt_bundle_schema TEXT,
      prompt_bundle_text TEXT,
      prompt_bundle_utf8_bytes INTEGER,
      prompt_bundle_sha256 TEXT,
      frozen_input_identity_json TEXT,
      blocked_reason_codes_json TEXT,
      blocked_visible_text TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL, intent_resolution_version INTEGER,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY(snapshot_id) REFERENCES applied_plugin_snapshots(id)
    );

CREATE TABLE strategy_task_frozen_skill_packages (
      task_execution_id TEXT PRIMARY KEY,
      schema TEXT NOT NULL,
      identity TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      FOREIGN KEY(task_execution_id) REFERENCES strategy_task_executions(task_execution_id)
        ON DELETE CASCADE
    );

CREATE TABLE strategy_task_intent_resolution (
      task_execution_id TEXT PRIMARY KEY REFERENCES strategy_task_executions(task_execution_id) ON DELETE CASCADE,
      version INTEGER NOT NULL CHECK(version = 1),
      state TEXT NOT NULL CHECK(state IN ('unresolved','claimed','started','resolved','failed')),
      attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts IN (0,1)),
      run_id TEXT UNIQUE,
      source_run_id TEXT,
      source_result_json TEXT,
      source_result_sha256 TEXT,
      reply_json TEXT,
      reply_sha256 TEXT
    );

CREATE TABLE strategy_task_run_write_evidence (
      task_execution_id TEXT NOT NULL REFERENCES strategy_task_executions(task_execution_id) ON DELETE CASCADE,
      run_id TEXT NOT NULL,
      files_written INTEGER NOT NULL CHECK(files_written >= 0),
      unknown INTEGER NOT NULL CHECK(unknown IN (0,1)),
      source_mask INTEGER NOT NULL CHECK(source_mask BETWEEN 1 AND 7),
      PRIMARY KEY(task_execution_id, run_id),
      FOREIGN KEY(run_id) REFERENCES strategy_task_runs(run_id)
    );

CREATE TABLE strategy_task_runs (
      task_execution_id TEXT NOT NULL,
      run_id TEXT NOT NULL UNIQUE,
      input_stage TEXT NOT NULL CHECK (
        input_stage IN ('request', 'clarification', 'contract_repair', 'production')
      ),
      task_run_index INTEGER NOT NULL CHECK (task_run_index >= 0),
      source_run_id TEXT,
      final_text_kind TEXT,
      final_text_schema TEXT,
      final_text TEXT,
      final_text_utf8_bytes INTEGER,
      final_text_sha256 TEXT,
      created_at INTEGER NOT NULL,
      PRIMARY KEY(task_execution_id, task_run_index),
      FOREIGN KEY(task_execution_id) REFERENCES strategy_task_executions(task_execution_id)
        ON DELETE CASCADE
    );

CREATE TABLE tabs (
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      position INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(project_id, name),
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

CREATE TABLE tabs_state (
      project_id TEXT PRIMARY KEY,
      updated_at INTEGER NOT NULL,
      state_json TEXT,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

CREATE TABLE team_project_materializations (
      workspace_id TEXT NOT NULL,
      resource_team_id TEXT NOT NULL,
      viewer_member_id TEXT NOT NULL,
      owner_member_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      ref TEXT NOT NULL CHECK (ref = 'published'),
      version INTEGER NOT NULL,
      version_id TEXT NOT NULL,
      manifest_digest TEXT NOT NULL,
      lifecycle_state TEXT NOT NULL CHECK (lifecycle_state = 'active'),
      authorized_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (workspace_id, project_id),
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

CREATE TABLE templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      source_project_id TEXT,
      files_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

CREATE TABLE workspace_artifacts (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      current_path TEXT,
      kind TEXT NOT NULL,
      mime TEXT,
      current_digest TEXT,
      current_size INTEGER,
      current_mtime INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

CREATE TABLE workspace_projects (
      project_id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      visibility TEXT NOT NULL CHECK (visibility IN ('personal', 'team')),
      resource_state TEXT NOT NULL CHECK (resource_state IN ('active', 'frozen', 'deleted')),
      created_by_workspace_member_id TEXT,
      updated_by_workspace_member_id TEXT,
      resource_hub_resource_id TEXT,
      cloud_tombstoned_at INTEGER,
      sync_state TEXT,
      metadata_refresh_pending INTEGER NOT NULL DEFAULT 0,
      version INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

CREATE TABLE workspace_resources (
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      visibility TEXT NOT NULL CHECK (visibility IN ('personal', 'team')),
      resource_state TEXT,
      created_by_workspace_member_id TEXT,
      updated_by_workspace_member_id TEXT,
      resource_hub_resource_id TEXT,
      cloud_tombstoned_at INTEGER,
      sync_state TEXT,
      version INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (resource_type, resource_id)
    );
