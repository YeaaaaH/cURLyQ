import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import {
  type KeyValuePair,
  ensureTrailingBlankRow,
  removeRow,
  stripEmptyRows,
  updateRows,
} from "@/lib/keyValue";
import {
  type Environment,
  buildPostmanEnvironment,
  createEnvironment,
  nextEnvironmentName,
  parsePostmanEnvironment,
} from "@/lib/environments";
import { createVariableContext, environmentScope } from "@/lib/variables";
import { type ImportExportLogEntry, pluralize } from "@/lib/importExportLog";
import { runImportExportWithFeedback } from "@/lib/importExportFeedback";

interface UseEnvironmentsParams {
  onLogEntry: (entry: Omit<ImportExportLogEntry, "id" | "timestamp">) => void;
}

export function useEnvironments({ onLogEntry }: UseEnvironmentsParams) {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [activeEnvironmentId, setActiveEnvironmentId] = useState<string | null>(
    () => localStorage.getItem("curlyq-active-environment-id")
  );

  useEffect(() => {
    invoke<Environment[]>("load_environments").then((saved) => {
      if (saved.length > 0) {
        setEnvironments(
          saved.map((e) => ({ ...e, variables: ensureTrailingBlankRow(e.variables) }))
        );
      }
    });
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      invoke("save_environments", {
        environments: environments.map((e) => ({ ...e, variables: stripEmptyRows(e.variables) })),
      });
    }, 500);
    return () => clearTimeout(timeout);
  }, [environments]);

  useEffect(() => {
    if (activeEnvironmentId === null) {
      localStorage.removeItem("curlyq-active-environment-id");
    } else {
      localStorage.setItem("curlyq-active-environment-id", activeEnvironmentId);
    }
  }, [activeEnvironmentId]);

  const activeEnvironment = environments.find((e) => e.id === activeEnvironmentId) ?? null;
  const variableContext = useMemo(
    () => createVariableContext([environmentScope(activeEnvironment)]),
    [activeEnvironment]
  );

  const [environmentEditorOpen, setEnvironmentEditorOpen] = useState(false);
  const [editingEnvironmentId, setEditingEnvironmentId] = useState<string | null>(null);

  // useCallback: these reach the React.memo'd Sidebar.
  const openEnvironmentEditor = useCallback((id: string) => {
    setEditingEnvironmentId(id);
    setEnvironmentEditorOpen(true);
  }, []);

  const handleAddEnvironment = useCallback(() => {
    // Derived from `prev` so rapid clicks don't pick the same name.
    const id = crypto.randomUUID();
    setEnvironments((prev) => [...prev, { ...createEnvironment(nextEnvironmentName(prev)), id }]);
    setEditingEnvironmentId(id);
  }, []);

  function handleRenameEnvironment(id: string, name: string) {
    setEnvironments((prev) => prev.map((e) => (e.id === id ? { ...e, name } : e)));
  }

  const handleImportEnvironment = useCallback(async () => {
    const path = await open({
      multiple: false,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!path) return;
    const fileName = path.split(/[\\/]/).pop() ?? path;

    await runImportExportWithFeedback({
      onLogEntry,
      direction: "import",
      kind: "environment",
      fallbackLabel: fileName,
      operation: async () => {
        const raw = await invoke<string>("read_text_file", { path });
        const environment = parsePostmanEnvironment(JSON.parse(raw), environments);
        setEnvironments((prev) => [...prev, environment]);
        setEditingEnvironmentId(environment.id);
        setEnvironmentEditorOpen(true);
        const detail = pluralize(
          environment.variables.filter((v) => v.key.trim() !== "").length,
          "variable"
        );
        return { label: environment.name, detail };
      },
    });
  }, [environments, onLogEntry]);

  const handleExportEnvironment = useCallback(
    async (id: string) => {
      const environment = environments.find((e) => e.id === id);
      if (!environment) return;

      const path = await save({
        defaultPath: `${environment.name}.postman_environment.json`,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!path) return;

      await runImportExportWithFeedback({
        onLogEntry,
        direction: "export",
        kind: "environment",
        fallbackLabel: environment.name,
        operation: async () => {
          const json = JSON.stringify(buildPostmanEnvironment(environment), null, 2);
          await invoke("write_text_file", { path, contents: json });
          const detail = pluralize(
            environment.variables.filter((v) => v.key.trim() !== "").length,
            "variable"
          );
          return { label: environment.name, detail };
        },
      });
    },
    [environments, onLogEntry]
  );

  const handleDeleteEnvironment = useCallback(
    (id: string) => {
      const remaining = environments.filter((e) => e.id !== id);
      setEnvironments(remaining);
      if (activeEnvironmentId === id) setActiveEnvironmentId(null);
      if (editingEnvironmentId === id) setEditingEnvironmentId(remaining[0]?.id ?? null);
    },
    [environments, activeEnvironmentId, editingEnvironmentId]
  );

  // Stores the id, not a callback, so confirming always reads the current list.
  const [pendingDeleteEnvironmentId, setPendingDeleteEnvironmentId] = useState<string | null>(null);
  const pendingDeleteEnvironment = environments.find((e) => e.id === pendingDeleteEnvironmentId) ?? null;

  const requestDeleteEnvironment = useCallback(
    (id: string) => {
      const environment = environments.find((e) => e.id === id);
      const variableCount = environment?.variables.filter((v) => v.key.trim() !== "").length ?? 0;
      if (environment && variableCount > 0) {
        setPendingDeleteEnvironmentId(id);
        return;
      }
      handleDeleteEnvironment(id);
    },
    [environments, handleDeleteEnvironment]
  );

  function confirmDeleteEnvironment() {
    if (pendingDeleteEnvironmentId) handleDeleteEnvironment(pendingDeleteEnvironmentId);
    setPendingDeleteEnvironmentId(null);
  }

  function cancelDeleteEnvironment() {
    setPendingDeleteEnvironmentId(null);
  }

  const updateEnvironmentVariable = useCallback(
    (index: number, patch: Partial<KeyValuePair>) => {
      if (editingEnvironmentId === null) return;
      setEnvironments((prev) =>
        prev.map((e) =>
          e.id === editingEnvironmentId ? { ...e, variables: updateRows(e.variables, index, patch) } : e
        )
      );
    },
    [editingEnvironmentId]
  );

  const removeEnvironmentVariable = useCallback(
    (index: number) => {
      if (editingEnvironmentId === null) return;
      setEnvironments((prev) =>
        prev.map((e) =>
          e.id === editingEnvironmentId ? { ...e, variables: removeRow(e.variables, index) } : e
        )
      );
    },
    [editingEnvironmentId]
  );

  const updateActiveEnvironmentVariable = useCallback(
    (name: string, value: string) => {
      if (activeEnvironmentId === null) return;
      setEnvironments((prev) =>
        prev.map((e) =>
          e.id === activeEnvironmentId
            ? { ...e, variables: e.variables.map((v) => (v.key === name ? { ...v, value } : v)) }
            : e
        )
      );
    },
    [activeEnvironmentId]
  );

  const applyEnvironmentPatch = useCallback(
    (patch: Record<string, string>) => {
      const entries = Object.entries(patch);
      if (activeEnvironmentId === null || entries.length === 0) return;
      setEnvironments((prev) =>
        prev.map((e) => {
          if (e.id !== activeEnvironmentId) return e;
          let variables = e.variables;
          for (const [key, value] of entries) {
            const existingIndex = variables.findIndex((v) => v.key === key);
            variables =
              existingIndex !== -1
                ? variables.map((v, i) => (i === existingIndex ? { ...v, value } : v))
                : [...variables, { id: crypto.randomUUID(), key, value, enabled: true }];
          }
          return { ...e, variables: ensureTrailingBlankRow(stripEmptyRows(variables)) };
        })
      );
    },
    [activeEnvironmentId]
  );

  return {
    environments,
    activeEnvironmentId,
    setActiveEnvironmentId,
    activeEnvironment,
    variableContext,
    applyEnvironmentPatch,
    environmentEditorOpen,
    setEnvironmentEditorOpen,
    editingEnvironmentId,
    setEditingEnvironmentId,
    openEnvironmentEditor,
    handleAddEnvironment,
    handleRenameEnvironment,
    handleImportEnvironment,
    handleExportEnvironment,
    pendingDeleteEnvironment,
    requestDeleteEnvironment,
    confirmDeleteEnvironment,
    cancelDeleteEnvironment,
    updateEnvironmentVariable,
    removeEnvironmentVariable,
    updateActiveEnvironmentVariable,
  };
}
