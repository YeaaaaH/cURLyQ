import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Folder } from "lucide-react";
import { cn } from "@/lib/utils";
import { METHOD_COLORS } from "@/lib/http";
import type { Collection, CollectionNode, FolderNode, RequestNode } from "@/lib/collections";
import { NodeMenu, QuickAddRequestButton, RenameInput } from "./TreeControls";
import { BeforeDropZone, EndDropZone, useTreeDragAndDrop } from "./TreeDragAndDrop";
import { ACTIVE_DROP_BORDER_CLASS, EMPTY_LABEL_OFFSET_PX, TREE_INDENT_PX } from "./constants";
import type { TreeHandlers } from "./types";

interface BaseNodeRowProps {
  collectionId: string;
  depth: number;
  handlers: TreeHandlers;
}

interface NodeRowProps extends BaseNodeRowProps {
  node: CollectionNode;
}

export function NodeRow({ node, ...rest }: NodeRowProps) {
  return node.type === "folder" ? <FolderRow {...rest} node={node} /> : <RequestRow {...rest} node={node} />;
}

interface FolderRowProps extends BaseNodeRowProps {
  node: FolderNode;
}

function FolderRow({ collectionId, node, depth, handlers }: FolderRowProps) {
  const { renamingId, onStartRename, onCancelRename, onAddFolder, onAddRequest, onRenameNode, requestDeleteNode, isOpen, setOpen, isDragActive } =
    handlers;
  const isRenaming = renamingId === node.id;
  const dnd = useTreeDragAndDrop(node.id, isRenaming);

  function addRequestToFolder() {
    onAddRequest(collectionId, node.id);
    setOpen(node.id, true);
  }

  function addFolderToFolder() {
    onStartRename(onAddFolder(collectionId, node.id));
    setOpen(node.id, true);
  }

  return (
    <>
      <BeforeDropZone nodeId={node.id} depth={depth} isDragActive={isDragActive} />
      <Collapsible open={isOpen(node.id, false)} onOpenChange={(open) => setOpen(node.id, open)} className="flex flex-col">
        <div
          ref={dnd.setNodeRef}
          {...dnd.attributes}
          {...dnd.listeners}
          className={cn(
            "group/node flex shrink-0 items-center rounded-md",
            dnd.isDragging && "opacity-40",
            dnd.isOver && "bg-accent"
          )}
          style={{ paddingLeft: depth * TREE_INDENT_PX }}
        >
          <CollapsibleTrigger
            disabled={isRenaming}
            className="group flex min-w-0 flex-1 items-center gap-1 rounded-md px-1 py-1 text-left text-sm text-muted-foreground hover:text-foreground"
          >
            <span className="flex w-8 shrink-0 items-center gap-0.5">
              <ChevronDown className="size-3 shrink-0 transition-transform group-data-[state=closed]:-rotate-90" />
              <Folder className="size-3.5 shrink-0" />
            </span>
            {isRenaming ? (
              <RenameInput
                name={node.name}
                onCommit={(name) => {
                  onRenameNode(collectionId, node.id, name);
                  onCancelRename();
                }}
                onCancel={onCancelRename}
              />
            ) : (
              <span className="min-w-0 flex-1 truncate">{node.name}</span>
            )}
          </CollapsibleTrigger>
          <QuickAddRequestButton onClick={addRequestToFolder} />
          <NodeMenu
            onNewFolder={addFolderToFolder}
            onNewRequest={addRequestToFolder}
            onRename={() => onStartRename(node.id)}
            onDelete={() => requestDeleteNode(collectionId, node)}
          />
        </div>
        <CollapsibleContent className="flex flex-col gap-0.5">
          {node.items.length === 0 ? (
            <p className="px-2 py-1 text-xs text-muted-foreground" style={{ paddingLeft: (depth + 1) * TREE_INDENT_PX + EMPTY_LABEL_OFFSET_PX }}>
              Empty
            </p>
          ) : (
            <>
              {node.items.map((child) => (
                <NodeRow key={child.id} collectionId={collectionId} node={child} depth={depth + 1} handlers={handlers} />
              ))}
              <EndDropZone containerId={node.id} depth={depth + 1} isDragActive={isDragActive} />
            </>
          )}
        </CollapsibleContent>
      </Collapsible>
    </>
  );
}

interface RequestRowProps extends BaseNodeRowProps {
  node: RequestNode;
}

function RequestRow({ collectionId, node, depth, handlers }: RequestRowProps) {
  const { renamingId, onStartRename, onCancelRename, onOpenRequest, onRenameNode, requestDeleteNode } = handlers;
  const isRenaming = renamingId === node.id;
  const dnd = useTreeDragAndDrop(node.id, isRenaming);

  return (
    <div
      ref={dnd.setNodeRef}
      {...dnd.attributes}
      {...dnd.listeners}
      className={cn(
        "group/node flex shrink-0 items-center rounded-md border-t-2",
        dnd.isDragging && "opacity-40",
        // Dropping on a request always means "insert before it," so a line
        // above the row shows exactly where the dragged item will land. A
        // toggled border color (width always reserved) instead of an
        // absolutely-positioned overlay — the latter rendered at a
        // different sub-pixel Y-offset per row depending on scroll
        // position and looked visibly blurred on some rows.
        dnd.isOver ? cn("rounded-t-none", ACTIVE_DROP_BORDER_CLASS) : "border-transparent"
      )}
      style={{ paddingLeft: depth * TREE_INDENT_PX }}
    >
      <button
        type="button"
        disabled={isRenaming}
        onClick={() => onOpenRequest(collectionId, node)}
        className="flex min-w-0 flex-1 items-center gap-1 rounded-md px-1 py-1 text-left text-sm text-muted-foreground hover:text-foreground"
      >
        <span
          className={cn(
            "w-8 shrink-0 overflow-hidden text-center text-[9px] font-semibold tracking-tighter",
            METHOD_COLORS[node.method]
          )}
        >
          {node.method}
        </span>
        {isRenaming ? (
          <RenameInput
            name={node.name}
            onCommit={(name) => {
              onRenameNode(collectionId, node.id, name);
              onCancelRename();
            }}
            onCancel={onCancelRename}
          />
        ) : (
          <span className="min-w-0 flex-1 truncate">{node.name}</span>
        )}
      </button>
      <NodeMenu onRename={() => onStartRename(node.id)} onDelete={() => requestDeleteNode(collectionId, node)} />
    </div>
  );
}

export interface CollectionRowProps {
  collection: Collection;
  isRenaming: boolean;
  isOpen: (id: string, defaultOpen: boolean) => boolean;
  setOpen: (id: string, open: boolean) => void;
  onStartRename: (id: string) => void;
  onCancelRename: () => void;
  onRenameCollection: (id: string, name: string) => void;
  onRequestDeleteCollection: () => void;
  onExportCollection: (id: string) => void;
  onAddFolder: (collectionId: string, parentFolderId: string | null) => string;
  onAddRequest: (collectionId: string, parentFolderId: string | null) => string;
  handlers: TreeHandlers;
}

export function CollectionRow({
  collection,
  isRenaming,
  isOpen,
  setOpen,
  onStartRename,
  onCancelRename,
  onRenameCollection,
  onRequestDeleteCollection,
  onExportCollection,
  onAddFolder,
  onAddRequest,
  handlers,
}: CollectionRowProps) {
  // Collections cannot be dragged but remain valid drop targets for content
  // dropped onto their root.
  const dnd = useTreeDragAndDrop(collection.id, isRenaming, false);

  function addRootRequest() {
    onAddRequest(collection.id, null);
    setOpen(collection.id, true);
  }

  function addRootFolder() {
    onStartRename(onAddFolder(collection.id, null));
    setOpen(collection.id, true);
  }

  return (
    <Collapsible open={isOpen(collection.id, false)} onOpenChange={(open) => setOpen(collection.id, open)} className="flex flex-col">
      <div
        ref={dnd.setNodeRef}
        {...dnd.attributes}
        {...dnd.listeners}
        className={cn("group/node flex shrink-0 items-center rounded-md", dnd.isOver && "bg-accent")}
      >
        <CollapsibleTrigger
          disabled={isRenaming}
          className="group flex min-w-0 flex-1 items-center gap-1 rounded-md px-1 py-1 text-left text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <span className="flex w-8 shrink-0 items-center gap-0.5">
            <ChevronDown className="size-3 shrink-0 transition-transform group-data-[state=closed]:-rotate-90" />
            <Folder className="size-3.5 shrink-0" />
          </span>
          {isRenaming ? (
            <RenameInput
              name={collection.name}
              onCommit={(name) => {
                onRenameCollection(collection.id, name);
                onCancelRename();
              }}
              onCancel={onCancelRename}
            />
          ) : (
            <span className="min-w-0 flex-1 truncate">{collection.name}</span>
          )}
        </CollapsibleTrigger>
        <QuickAddRequestButton onClick={addRootRequest} />
        <NodeMenu
          onNewFolder={addRootFolder}
          onNewRequest={addRootRequest}
          onRename={() => onStartRename(collection.id)}
          onExport={() => onExportCollection(collection.id)}
          onDelete={onRequestDeleteCollection}
        />
      </div>
      <CollapsibleContent className="flex flex-col gap-0.5 pl-3">
        {collection.items.length === 0 ? (
          <p className="px-2 py-1 text-xs text-muted-foreground">Empty</p>
        ) : (
          <>
            {collection.items.map((node) => (
              <NodeRow key={node.id} collectionId={collection.id} node={node} depth={0} handlers={handlers} />
            ))}
            <EndDropZone containerId={collection.id} depth={0} isDragActive={handlers.isDragActive} />
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
