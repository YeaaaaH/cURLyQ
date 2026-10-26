---
name: react-dev
version: 1.0.0
description: TypeScript typing patterns for cURLyQ's React 19 frontend — component props, event handlers, hooks, refs, and generic components. Use when writing or typing React components or hooks in src/. For styling and UI conventions, see curlyq-ui.
---

# React TypeScript

Type-safe React = compile-time guarantees = confident refactoring.

cURLyQ is a client-only React 19 SPA inside Tauri's webview: no server rendering, no Server Components or Server Actions, no router. Data comes from Tauri commands via `invoke()`, not from fetching.

<when_to_use>

- Building typed React components
- Implementing generic components
- Typing event handlers, forms, refs
- Custom hooks with proper typing

NOT for: non-React TypeScript, styling (see curlyq-ui)

</when_to_use>

<react_19_changes>

**ref as prop** - forwardRef deprecated:

```typescript
// React 19 - ref as regular prop
type ButtonProps = {
  ref?: React.Ref<HTMLButtonElement>;
} & React.ComponentPropsWithoutRef<'button'>;

function Button({ ref, children, ...props }: ButtonProps) {
  return <button ref={ref} {...props}>{children}</button>;
}
```

See [react-19-patterns.md](references/react-19-patterns.md) for ref patterns, useTransition, and useDeferredValue.

</react_19_changes>

<component_patterns>

**Props** - extend native elements:

```typescript
type ButtonProps = {
  variant: 'primary' | 'secondary';
} & React.ComponentPropsWithoutRef<'button'>;

function Button({ variant, children, ...props }: ButtonProps) {
  return <button className={variant} {...props}>{children}</button>;
}
```

**Children typing**:

```typescript
type Props = {
  children: React.ReactNode;          // Anything renderable
  icon: React.ReactElement;           // Single element
  render: (data: T) => React.ReactNode;  // Render prop
};
```

**Discriminated unions** for variant props:

```typescript
type ButtonProps =
  | { variant: 'link'; href: string }
  | { variant: 'button'; onClick: () => void };

function Button(props: ButtonProps) {
  if (props.variant === 'link') {
    return <a href={props.href}>Link</a>;
  }
  return <button onClick={props.onClick}>Button</button>;
}
```

</component_patterns>

<event_handlers>

Use specific event types for accurate target typing:

```typescript
// Mouse
function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.disabled = true;
}

// Form
function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  const formData = new FormData(e.currentTarget);
}

// Input
function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
  console.log(e.target.value);
}

// Keyboard
function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Enter') e.currentTarget.blur();
}
```

See [event-handlers.md](references/event-handlers.md) for focus, drag, clipboard, touch, wheel events.

</event_handlers>

<hooks_typing>

**useState** - explicit for unions/null:

```typescript
const [user, setUser] = useState<User | null>(null);
const [status, setStatus] = useState<'idle' | 'loading'>('idle');
```

**useRef** - null for DOM, value for mutable:

```typescript
const inputRef = useRef<HTMLInputElement>(null);  // DOM - use ?.
const countRef = useRef<number>(0);               // Mutable - direct access
```

**useReducer** - discriminated unions for actions:

```typescript
type Action =
  | { type: 'increment' }
  | { type: 'set'; payload: number };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'set': return { ...state, count: action.payload };
    default: return state;
  }
}
```

**Custom hooks** - tuple returns with as const:

```typescript
function useToggle(initial = false) {
  const [value, setValue] = useState(initial);
  const toggle = () => setValue(v => !v);
  return [value, toggle] as const;
}
```

**useContext** - null guard pattern:

```typescript
const UserContext = createContext<User | null>(null);

function useUser() {
  const user = useContext(UserContext);
  if (!user) throw new Error('useUser outside UserProvider');
  return user;
}
```

See [hooks.md](references/hooks.md) for useCallback, useMemo, useImperativeHandle, useSyncExternalStore.

</hooks_typing>

<generic_components>

Generic components infer types from props - no manual annotations at call site.

**Pattern** - keyof T for column keys, render props for custom rendering:

```typescript
type Column<T> = {
  key: keyof T;
  header: string;
  render?: (value: T[keyof T], item: T) => React.ReactNode;
};

type TableProps<T> = {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string | number;
};

function Table<T>({ data, columns, keyExtractor }: TableProps<T>) {
  return (
    <table>
      <thead>
        <tr>{columns.map(col => <th key={String(col.key)}>{col.header}</th>)}</tr>
      </thead>
      <tbody>
        {data.map(item => (
          <tr key={keyExtractor(item)}>
            {columns.map(col => (
              <td key={String(col.key)}>
                {col.render ? col.render(item[col.key], item) : String(item[col.key])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

**Constrained generics** for required properties:

```typescript
type HasId = { id: string | number };

function List<T extends HasId>({ items }: { items: T[] }) {
  return <ul>{items.map(item => <li key={item.id}>...</li>)}</ul>;
}
```

See [generic-components.md](examples/generic-components.md) for Select, List, Modal, FormField patterns.

</generic_components>

<rules>

ALWAYS:
- Specific event types (MouseEvent, ChangeEvent, etc)
- Explicit useState for unions/null
- ComponentPropsWithoutRef for native element extension
- Discriminated unions for variant props
- as const for tuple returns
- ref as prop in React 19 (no forwardRef)

NEVER:
- any for event handlers
- JSX.Element for children (use ReactNode)
- forwardRef in React 19+
- Forget null handling for DOM refs
- Server Components, Server Actions, or 'use client'/'use server' directives — this is a client-only SPA

</rules>

<references>

- [hooks.md](references/hooks.md) - useState, useRef, useReducer, useContext, custom hooks
- [event-handlers.md](references/event-handlers.md) - all event types, generic handlers
- [react-19-patterns.md](references/react-19-patterns.md) - ref as prop, useTransition, useDeferredValue
- [generic-components.md](examples/generic-components.md) - Table, Select, List, Modal patterns

</references>
