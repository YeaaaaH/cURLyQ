# React 19 TypeScript Patterns

Client-side React 19 patterns used in this project.

## ref as Prop (No More forwardRef)

React 19 allows ref as regular prop — forwardRef deprecated but still works.

```typescript
// ✅ React 19 - ref as prop
type InputProps = {
  ref?: React.Ref<HTMLInputElement>;
  label: string;
} & React.ComponentPropsWithoutRef<'input'>;

export function Input({ ref, label, ...props }: InputProps) {
  return (
    <div>
      <label>{label}</label>
      <input ref={ref} {...props} />
    </div>
  );
}

// Usage
function Form() {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form>
      <Input ref={inputRef} label="Name" />
      <button onClick={() => inputRef.current?.focus()}>Focus</button>
    </form>
  );
}
```

```typescript
// ❌ Old pattern (still works, but unnecessary)
import { forwardRef } from 'react';

type InputProps = {
  label: string;
} & React.ComponentPropsWithoutRef<'input'>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, ...props }, ref) => {
    return (
      <div>
        <label>{label}</label>
        <input ref={ref} {...props} />
      </div>
    );
  }
);

Input.displayName = 'Input';
```

### Generic Components with ref

```typescript
type SelectProps<T> = {
  ref?: React.Ref<HTMLSelectElement>;
  options: T[];
  value: T;
  onChange: (value: T) => void;
  getLabel: (option: T) => string;
};

export function Select<T>({ ref, options, value, onChange, getLabel }: SelectProps<T>) {
  return (
    <select
      ref={ref}
      value={getLabel(value)}
      onChange={(e) => {
        const selected = options.find((opt) => getLabel(opt) === e.target.value);
        if (selected) onChange(selected);
      }}
    >
      {options.map((opt) => (
        <option key={getLabel(opt)} value={getLabel(opt)}>
          {getLabel(opt)}
        </option>
      ))}
    </select>
  );
}
```

### Combining ref with Other Props

```typescript
type ButtonProps = {
  ref?: React.Ref<HTMLButtonElement>;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
} & React.ComponentPropsWithoutRef<'button'>;

export function Button({
  ref,
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      ref={ref}
      className={`btn btn-${variant} btn-${size} ${className || ''}`}
      {...props}
    >
      {children}
    </button>
  );
}
```

## useTransition - Non-Blocking Updates

Mark state updates as non-urgent — UI stays responsive.

```typescript

import { useTransition, useState } from 'react';

export function SearchResults() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  function handleSearch(value: string) {
    setQuery(value); // Urgent - update input immediately

    startTransition(() => {
      // Non-urgent - can be interrupted
      const filtered = hugeDataset.filter((item) =>
        item.toLowerCase().includes(value.toLowerCase())
      );
      setResults(filtered);
    });
  }

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Search..."
      />

      {isPending && <div>Searching...</div>}

      <ul>
        {results.map((result) => (
          <li key={result}>{result}</li>
        ))}
      </ul>
    </div>
  );
}
```

## useDeferredValue - Deferred Rendering

Defer expensive re-renders while keeping UI responsive.

```typescript

import { useDeferredValue, useState } from 'react';

export function ProductSearch() {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search products..."
      />

      {/* Uses deferred value - won't block input */}
      <ExpensiveResults query={deferredQuery} />
    </div>
  );
}

function ExpensiveResults({ query }: { query: string }) {
  const results = useMemo(() => {
    // Expensive filtering/sorting
    return products.filter((p) => p.name.includes(query));
  }, [query]);

  return (
    <ul>
      {results.map((result) => (
        <li key={result.id}>{result.name}</li>
      ))}
    </ul>
  );
}
```
