import { useId, useMemo, useState } from "react";
import { Minus, Plus, Search, Trash2, Pencil } from "lucide-react";
import { entrySchema, searchFoods, type Food, type FoodEntry } from "./model";

function Highlight({ text, query }: { text: string; query: string }) {
  const index = text.toLowerCase().indexOf(query.trim().toLowerCase());
  if (index < 0 || !query.trim()) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + query.trim().length)}</mark>
      {text.slice(index + query.trim().length)}
    </>
  );
}
export default function FoodEditor({
  foods,
  value,
  onChange,
}: {
  foods: Food[];
  value: { skipped: boolean; entries: FoodEntry[] };
  onChange: (v: typeof value) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState<FoodEntry | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [editing, setEditing] = useState<number | null>(null);
  const [error, setError] = useState("");
  const results = useMemo(() => searchFoods(foods, query), [foods, query]);
  function choose(food: Food) {
    setSelected({
      source: "INDB",
      foodCode: food.foodCode,
      name: food.name,
      unit: food.unit,
      quantity: 1,
    });
    setQuantity("1");
    setOpen(false);
    setEditing(null);
    setError("");
  }
  function save() {
    const result = entrySchema.safeParse({
      ...selected,
      quantity: Number(quantity),
    });
    if (!result.success) {
      setError(
        result.error.issues
          .map((i) => `${i.path.join(" ")}: ${i.message}`)
          .join(" "),
      );
      return;
    }
    if (editing === null && value.entries.length >= 8) {
      setError("You can add up to 8 foods in each meal.");
      return;
    }
    const entries = [...value.entries];
    if (editing === null) entries.push(result.data);
    else entries[editing] = result.data;
    onChange({ skipped: false, entries });
    setSelected(null);
    setEditing(null);
    setQuery("");
    setError("");
  }
  return (
    <>
      <label className="check skip">
        <input
          type="checkbox"
          checked={value.skipped}
          onChange={(e) => {
            if (
              e.target.checked &&
              value.entries.length &&
              !window.confirm(
                "Remove the foods in this meal and mark it as skipped?",
              )
            )
              return;
            onChange({ skipped: e.target.checked, entries: [] });
            setSelected(null);
            setEditing(null);
          }}
        />
        I usually skip this meal
      </label>
      {!value.skipped && (
        <>
          <div className="search-wrap">
            <label htmlFor={`${id}-search`}>Search for a food</label>
            <div className="search-input">
              <Search size={19} />
              <input
                id={`${id}-search`}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={open && results.length > 0}
                aria-controls={`${id}-list`}
                aria-activedescendant={
                  open && results[active] ? `${id}-option-${active}` : undefined
                }
                placeholder="Try rice, chapati, dal, or chai"
                value={query}
                onFocus={() => setOpen(true)}
                onBlur={() => setOpen(false)}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpen(true);
                  setActive(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setOpen(true);
                    setActive((a) => Math.min(a + 1, results.length - 1));
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((a) => Math.max(a - 1, 0));
                  }
                  if (e.key === "Escape") setOpen(false);
                  if (e.key === "Enter" && open && results[active]) {
                    e.preventDefault();
                    choose(results[active]);
                  }
                }}
              />
            </div>
            {open && query.trim() && (
              <div className="suggestions">
                <div className="search-count" role="status">
                  {results.length
                    ? `${results.length} matches. Select the closest recipe.`
                    : "No matching foods. You can add a custom food below."}
                </div>
                <ul
                  role="listbox"
                  id={`${id}-list`}
                  aria-label="Matching foods"
                >
                  {results.map((f, i) => (
                    <li
                      role="option"
                      aria-selected={i === active}
                      id={`${id}-option-${i}`}
                      key={f.foodCode}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => choose(f)}
                    >
                      <span>
                        <Highlight text={f.name} query={query} />
                      </span>
                      <small>{f.unit}</small>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <button
            className="text-button custom-trigger"
            onClick={() => {
              setSelected({
                source: "CUSTOM",
                foodCode: null,
                name: query,
                unit: "",
                quantity: 1,
                brand: "",
                preparation: "",
              });
              setQuantity("1");
              setEditing(null);
              setOpen(false);
            }}
          >
            Can’t find your food? Add a custom food
          </button>
          {selected && (
            <section className="food-form" aria-label="Food details">
              <div className="eyebrow">
                {editing === null ? "Add to this meal" : "Edit food"}
              </div>
              {selected.source === "INDB" ? (
                <>
                  <h3>{selected.name}</h3>
                  <p className="muted">
                    Use the listed household unit. Choose the closest recipe.
                  </p>
                </>
              ) : (
                <>
                  <h3>Describe your food</h3>
                  <p className="muted">
                    Please avoid names, contact details, or medical information.
                  </p>
                  <div className="field-grid">
                    <label>
                      Food name
                      <input
                        maxLength={200}
                        value={selected.name}
                        onChange={(e) =>
                          setSelected({ ...selected, name: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Brand (optional)
                      <input
                        maxLength={100}
                        value={selected.brand}
                        onChange={(e) =>
                          setSelected({ ...selected, brand: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Quantity unit
                      <input
                        placeholder="e.g. cup, piece, g, ml"
                        maxLength={80}
                        value={selected.unit}
                        onChange={(e) =>
                          setSelected({ ...selected, unit: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Preparation (optional)
                      <input
                        maxLength={300}
                        value={selected.preparation}
                        onChange={(e) =>
                          setSelected({
                            ...selected,
                            preparation: e.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                </>
              )}
              <div className="quantity-row">
                <label htmlFor={`${id}-quantity`}>
                  Quantity
                  {selected.source === "INDB" && (
                    <small> in {selected.unit}</small>
                  )}
                </label>
                <div className="quantity">
                  <button
                    aria-label="Decrease quantity"
                    onClick={() =>
                      setQuantity(
                        String(Math.max(0.25, Number(quantity) - 0.25)),
                      )
                    }
                  >
                    <Minus size={16} />
                  </button>
                  <input
                    id={`${id}-quantity`}
                    type="number"
                    min="0.001"
                    max="100"
                    step="any"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                  <button
                    aria-label="Increase quantity"
                    onClick={() =>
                      setQuantity(
                        String(Math.min(100, Number(quantity) + 0.25)),
                      )
                    }
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
              <p className="hint">
                Fractions are welcome, such as 0.5 or 1.25.
              </p>
              <div className="inline-actions">
                <button className="primary" onClick={save}>
                  {editing === null ? "Add Food" : "Save changes"}
                </button>
                <button
                  className="secondary"
                  onClick={() => {
                    setSelected(null);
                    setEditing(null);
                    setError("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </section>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <div className="meal-list">
            <h3>
              Your foods <span className="count">{value.entries.length}/8</span>
            </h3>
            {!value.entries.length ? (
              <p className="empty">
                No foods added yet. Include drinks you normally have with this
                meal.
              </p>
            ) : (
              <ul>
                {value.entries.map((entry, i) => (
                  <li key={i}>
                    <div>
                      <strong>{entry.name}</strong>
                      <small>
                        {entry.quantity} × {entry.unit}
                        {entry.source === "CUSTOM" && " · Custom food"}
                      </small>
                    </div>
                    <div className="inline-actions">
                      <button
                        className="icon-button"
                        aria-label={`Edit ${entry.name}`}
                        onClick={() => {
                          setSelected(entry);
                          setQuantity(String(entry.quantity));
                          setEditing(i);
                        }}
                      >
                        <Pencil size={17} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Remove ${entry.name}`}
                        onClick={() => {
                          onChange({
                            ...value,
                            entries: value.entries.filter((_, n) => n !== i),
                          });
                          setSelected(null);
                          setEditing(null);
                        }}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </>
  );
}
