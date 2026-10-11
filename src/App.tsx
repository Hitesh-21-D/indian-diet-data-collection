import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Leaf,
  LockKeyhole,
} from "lucide-react";
import FoodEditor from "./FoodEditor";
import {
  activities,
  ageSchema,
  avoidanceOptions,
  blankDraft,
  dayOptions,
  diets,
  eligibilityError,
  goals,
  mealKeys,
  mealLabels,
  mealSchema,
  minorPolicyReady,
  patterns,
  profileSchema,
  responseSchema,
  typicalOptions,
  type Catalog,
  type Draft,
  type Profile,
  type StudyPolicy,
} from "./model";
import { checkGuardianConsent, loadPolicy, submitResponse } from "./firebase";
import { DRAFT_KEY, readDraft, saveDraft } from "./draft";
import { withTimeout } from "./timeout";

const steps = [
  "Welcome & Consent",
  "Personal Profile",
  "Your Typical Day",
  "Breakfast",
  "Lunch",
  "Snacks & Beverages",
  "Dinner",
  "Review",
];
export default function App() {
  const [draft, setDraft] = useState<Draft>(readDraft);
  const [step, setStep] = useState(0);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [policy, setPolicy] = useState<StudyPolicy | null>(null);
  const [setupError, setSetupError] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [storageError, setStorageError] = useState(false);
  const [guardian, setGuardian] = useState({ uid: "", verified: false });
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [receipt, setReceipt] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  async function initialize() {
    setSetupError("");
    try {
      const [p, c] = await Promise.all([
        loadPolicy(),
        fetch(`${import.meta.env.BASE_URL}data/indb_food_catalog.json`).then(
          (r) => {
            if (!r.ok) throw new Error("Food catalog could not be loaded.");
            return r.json() as Promise<Catalog>;
          },
        ),
      ]);
      setPolicy(p);
      setCatalog(c);
      setDraft((d) => ({
        ...d,
        catalogVersion: d.catalogVersion || c.version,
        accurate: d.catalogVersion === c.version && d.accurate,
        consent:
          d.consent.version && d.consent.version !== p.consentVersion
            ? { ...d.consent, read: false, voluntary: false, assent: false }
            : d.consent,
      }));
      if (p.catalogVersion !== c.version)
        setSetupError(
          "The study team is updating the food catalog. Please return later.",
        );
    } catch (e) {
      setSetupError(
        e instanceof Error
          ? e.message
          : "Unable to load the study. Please try again.",
      );
    }
  }
  useEffect(() => {
    void initialize();
  }, []);
  useEffect(() => {
    if (receipt) return;
    try {
      saveDraft(draft);
    } catch {
      setStorageError(true);
    }
  }, [draft, receipt]);
  useEffect(() => {
    heading.current?.focus();
  }, [step, receipt]);
  const age = draft.profile.age;
  const minor = typeof age === "number" && age >= 16 && age < 18;
  function profile<K extends keyof Profile>(
    key: K,
    value: Profile[K] | undefined,
  ) {
    setDraft((d) => ({
      ...d,
      accurate: false,
      profile: { ...d.profile, [key]: value },
    }));
  }
  function navigate(next: number) {
    setError("");
    setFieldErrors({});
    setStep(next);
    window.scrollTo({ top: 0 });
  }
  function next() {
    setError("");
    setFieldErrors({});
    if (step === 0) {
      const message = eligibilityError(age, policy, guardian.verified);
      if (message || setupError || !catalog) {
        setError(message || setupError || "Please wait for the food catalog.");
        return;
      }
      if (
        !draft.consent.read ||
        !draft.consent.voluntary ||
        (minor && !draft.consent.assent)
      ) {
        setError(
          "Please read the participant information and confirm your voluntary consent" +
            (minor ? " and assent." : "."),
        );
        return;
      }
      setDraft((d) => ({
        ...d,
        catalogVersion: catalog.version,
        accurate: d.catalogVersion === catalog.version && d.accurate,
        consent: {
          ...d.consent,
          version: policy!.consentVersion,
          assent: minor && d.consent.assent,
          assentVersion: minor ? policy!.minorAssentVersion : "",
          guardianConsentVersion: minor ? policy!.guardianConsentVersion : "",
        },
      }));
    }
    if (step === 1) {
      const result = profileSchema.safeParse(draft.profile);
      if (!result.success) {
        setFieldErrors(
          Object.fromEntries(
            result.error.issues.map((i) => [i.path[0], i.message]),
          ),
        );
        setError("Please check the highlighted profile fields.");
        return;
      }
    }
    if (step === 2 && (!draft.dayType || !draft.dayRepresentativeness)) {
      setError("Select how typical your day is and its day type.");
      return;
    }
    if (step >= 3 && step <= 6) {
      const selectedMeal = draft.meals[mealKeys[step - 3]];
      if (
        selectedMeal.entries.some(
          (entry) =>
            entry.source === "INDB" &&
            !catalog?.foods.some(
              (food) =>
                food.foodCode === entry.foodCode &&
                food.name === entry.name &&
                food.unit === entry.unit,
            ),
        )
      ) {
        setError(
          "A food from your saved draft changed in the current catalog. Remove it and select it again.",
        );
        return;
      }
      const result = mealSchema.safeParse(draft.meals[mealKeys[step - 3]]);
      if (!result.success) {
        setError(result.error.issues[0].message);
        return;
      }
    }
    navigate(step + 1);
  }
  async function submit() {
    if (submitting.current || !catalog) return;
    const result = responseSchema.safeParse(draft);
    if (!result.success) {
      setError(
        "Please confirm your answers and complete all sections before submitting.",
      );
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const id = await withTimeout(submitResponse(draft, catalog), 25000);
      setReceipt(id);
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        setStorageError(true);
      }
      setDraft(blankDraft());
    } catch (e) {
      setError(
        e instanceof Error
          ? `Your response has not been confirmed. ${e.message} You can retry safely.`
          : "Unable to confirm submission. Your answers are still here. Please retry.",
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  function fieldError(key: string) {
    return fieldErrors[key] ? (
      <small className="error" id={`error-${key}`}>
        {fieldErrors[key]}
      </small>
    ) : null;
  }
  function selectField(
    key: "goal" | "diet" | "pattern" | "activity",
    label: string,
    options: readonly string[],
  ) {
    return (
      <label>
        {label}
        <select
          value={draft.profile[key] || ""}
          onChange={(e) => profile(key, e.target.value as Profile[typeof key])}
          aria-invalid={Boolean(fieldErrors[key])}
          aria-describedby={fieldErrors[key] ? `error-${key}` : undefined}
        >
          <option value="">
            {key === "pattern" || key === "activity"
              ? "Not specified"
              : "Select an option"}
          </option>
          {options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
        {fieldError(key)}
      </label>
    );
  }
  return (
    <>
      <a className="skip-link" href="#content">
        Skip to questionnaire
      </a>
      <header>
        <div className="header-inner">
          <a className="brand" href={import.meta.env.BASE_URL}>
            <span className="brand-mark">
              <Leaf size={23} />
            </span>
            <span>
              Everyday Diet Study
              <small>Dietary Habits Research Questionnaire</small>
            </span>
          </a>
          <span className="academic">
            <BookOpen size={16} />
            Academic Research
          </span>
        </div>
      </header>
      <main id="content">
        <div className="page-intro">
          <span className="eyebrow">The everyday matters</span>
          <h1>
            Your everyday meals.
            <br />A better understanding.
          </h1>
          <p>
            Help us understand the dietary habits that make up a typical day.
          </p>
        </div>
        {receipt ? (
          <section className="panel confirmation">
            <CheckCircle2 size={44} />
            <h2 ref={heading} tabIndex={-1}>
              Thank you for taking part.
            </h2>
            <p>Your response has been confirmed by the study database.</p>
            <p>
              Your contribution will support academic research on Indian dietary
              habits.
            </p>
            <div className="receipt">
              <strong>Your response reference</strong>
              <code>{receipt}</code>
              <button
                className="secondary"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(receipt)
                    .catch(() =>
                      setError("Select and copy the reference shown above."),
                    );
                }}
              >
                Copy reference
              </button>
            </div>
            <p className="muted">
              Keep this reference if you need to contact the research team.{" "}
              {policy?.withdrawal}
            </p>
            {policy && (
              <a href={`mailto:${policy.contactEmail}`}>
                {policy.contactEmail}
              </a>
            )}
            {error && <p role="alert">{error}</p>}
            {storageError && (
              <p className="error">
                Browser storage could not be cleared. Clear site data on this
                device.
              </p>
            )}
          </section>
        ) : (
          <div className="survey-layout">
            <aside>
              <div className="aside-title">Your questionnaire</div>
              <ol className="steps">
                {steps.map((s, i) => (
                  <li
                    key={s}
                    className={
                      step === i ? "current" : step > i ? "complete" : ""
                    }
                    aria-current={step === i ? "step" : undefined}
                  >
                    <span className="step-number">
                      {step > i ? (
                        <Check size={14} />
                      ) : (
                        String(i + 1).padStart(2, "0")
                      )}
                    </span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
              <div className="privacy-note">
                <LockKeyhole size={18} />
                <p>No name, email, phone number, or student ID is requested.</p>
              </div>
            </aside>
            <section className="panel">
              <div className="panel-top">
                <span className="eyebrow">
                  Step {step + 1} of {steps.length}
                </span>
                <span className="muted">
                  {Math.round((step / steps.length) * 100)}% complete
                </span>
              </div>
              <div className="progress">
                <div
                  style={{ width: `${((step + 1) / steps.length) * 100}%` }}
                />
              </div>
              <h2 ref={heading} tabIndex={-1}>
                {steps[step]}
              </h2>
              {step === 0 && (
                <>
                  {catalog &&
                    draft.catalogVersion &&
                    draft.catalogVersion !== catalog.version && (
                      <p className="notice">
                        The food catalog has changed since your saved draft.
                        Continuing uses the current catalog. Review each meal;
                        any food with a changed name or unit must be selected
                        again.
                      </p>
                    )}
                  <p className="lead">Tell us about what you normally eat.</p>
                  <p>
                    We are conducting an academic study to understand typical
                    dietary habits. Your responses will help evaluate a research
                    framework for personalized nutritional optimization of
                    Indian diets.
                  </p>
                  <div className="info-box">
                    <h3>Before you begin</h3>
                    <p>
                      Participation is voluntary. You may stop before
                      submitting. This questionnaire asks only for
                      research-related information and does not provide dietary
                      or medical advice.
                    </p>
                    <p>
                      We do not request direct identifiers. Demographic
                      information and Firebase technical identifiers mean we
                      cannot promise perfect anonymity.
                    </p>
                  </div>
                  {setupError && (
                    <div className="notice" role="status">
                      <strong>Study setup or connection needs attention</strong>
                      <p>{setupError}</p>
                      <button
                        className="secondary"
                        onClick={() => void initialize()}
                      >
                        Retry loading study
                      </button>
                    </div>
                  )}
                  {!policy && !setupError && (
                    <p role="status">Loading participant information…</p>
                  )}
                  {policy && (
                    <>
                      <dl className="study-details">
                        <div>
                          <dt>Research institution</dt>
                          <dd>{policy.institution}</dd>
                        </div>
                        <div>
                          <dt>Researcher contact</dt>
                          <dd>
                            <a href={`mailto:${policy.contactEmail}`}>
                              {policy.contactEmail}
                            </a>
                          </dd>
                        </div>
                        <div>
                          <dt>Data retention</dt>
                          <dd>{policy.retention}</dd>
                        </div>
                        <div>
                          <dt>Withdrawal procedure</dt>
                          <dd>{policy.withdrawal}</dd>
                        </div>
                        <div>
                          <dt>Ethics information</dt>
                          <dd>{policy.ethicsStatus}</dd>
                        </div>
                        <div>
                          <dt>Consent document</dt>
                          <dd>{policy.consentVersion}</dd>
                        </div>
                      </dl>
                      {!policy.collectionEnabled && (
                        <p className="notice">
                          The study is not open for responses yet.
                        </p>
                      )}
                    </>
                  )}
                  <label className="age-field">
                    Your age in completed years
                    <input
                      type="number"
                      inputMode="numeric"
                      min="16"
                      step="1"
                      value={age ?? ""}
                      onChange={(e) => {
                        profile(
                          "age",
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                        );
                        setGuardian({ uid: "", verified: false });
                        setDraft((d) => ({
                          ...d,
                          consent: {
                            ...d.consent,
                            read: false,
                            voluntary: false,
                            assent: false,
                          },
                        }));
                      }}
                    />
                    <small>
                      Participants must be 16 or older. There is no upper age
                      limit.
                    </small>
                  </label>
                  {age !== undefined && !ageSchema.safeParse(age).success && (
                    <p className="error" role="alert">
                      Enter a whole-number age of 16 or above.
                    </p>
                  )}
                  {minor && (
                    <div className="notice">
                      <h3>Participation at ages 16–17</h3>
                      {policy && minorPolicyReady(policy) ? (
                        <>
                          <p>{policy.minorProcedure}</p>
                          <p>
                            Your guardian’s consent must be verified by the
                            study team through its approved process. You may
                            freely choose whether to participate.
                          </p>
                          <p>
                            Assent document: {policy.minorAssentVersion}.
                            Guardian consent: {policy.guardianConsentVersion}.
                          </p>
                          <button
                            className="secondary"
                            disabled={checking}
                            onClick={async () => {
                              setChecking(true);
                              try {
                                setGuardian(await checkGuardianConsent(policy));
                              } catch {
                                setError(
                                  "Unable to check consent status. Please retry.",
                                );
                              } finally {
                                setChecking(false);
                              }
                            }}
                          >
                            {checking
                              ? "Checking…"
                              : "Check guardian consent status"}
                          </button>
                          {guardian.uid && (
                            <p>
                              Consent process reference:{" "}
                              <code className="wrap">{guardian.uid}</code>
                            </p>
                          )}
                          <p>
                            {guardian.verified
                              ? "Guardian consent is verified for this session."
                              : "Guardian consent has not been verified for this session."}
                          </p>
                        </>
                      ) : (
                        <p>
                          Participation for ages 16–17 is not open. Ethics
                          approval and the required consent procedures must be
                          configured before you can proceed.
                        </p>
                      )}
                    </div>
                  )}
                  <div className="consent-checks">
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={draft.consent.read}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            consent: { ...d.consent, read: e.target.checked },
                          }))
                        }
                      />
                      I have read the participant information.
                    </label>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={draft.consent.voluntary}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            consent: {
                              ...d.consent,
                              voluntary: e.target.checked,
                            },
                          }))
                        }
                      />
                      I voluntarily consent to participate.
                    </label>
                    {minor && (
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={draft.consent.assent}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              consent: {
                                ...d.consent,
                                assent: e.target.checked,
                              },
                            }))
                          }
                        />
                        I understand the study information for my age group and
                        freely agree to take part (assent).
                      </label>
                    )}
                  </div>
                  <p className="hint">
                    Consenting adults’ drafts stay on this browser for up to 7
                    days and are deleted after confirmed submission. Answers for
                    ages 16–17 stay only in this tab’s memory. Closing or
                    refreshing the tab clears them. Firebase stores a technical
                    sign-in identifier to support retries.
                  </p>
                </>
              )}
              {step === 1 && (
                <>
                  <p className="lead">A little context about you.</p>
                  <p className="muted">
                    These details help us study dietary patterns. Required
                    fields are shown first.
                  </p>
                  <div className="field-grid">
                    <label>
                      Age
                      <input value={age ?? ""} readOnly />
                      <small>
                        To change your age,{" "}
                        <button
                          className="text-button"
                          onClick={() => navigate(0)}
                        >
                          return to consent
                        </button>
                        .
                      </small>
                      {fieldError("age")}
                    </label>
                    <fieldset className="sex">
                      <legend>Sex (for nutritional estimation)</legend>
                      {(["male", "female"] as const).map((s) => (
                        <label className="radio" key={s}>
                          <input
                            type="radio"
                            name="sex"
                            value={s}
                            checked={draft.profile.sex === s}
                            onChange={() => profile("sex", s)}
                          />
                          {s === "male" ? "Male" : "Female"}
                        </label>
                      ))}
                      {fieldError("sex")}
                    </fieldset>
                    <label>
                      Height (cm)
                      <input
                        type="number"
                        step="any"
                        min="80"
                        max="250"
                        value={draft.profile.heightCm ?? ""}
                        onChange={(e) =>
                          profile(
                            "heightCm",
                            e.target.value === ""
                              ? undefined
                              : Number(e.target.value),
                          )
                        }
                        aria-invalid={Boolean(fieldErrors.heightCm)}
                      />
                      {fieldError("heightCm")}
                    </label>
                    <label>
                      Weight (kg)
                      <input
                        type="number"
                        step="any"
                        min="20"
                        max="350"
                        value={draft.profile.weightKg ?? ""}
                        onChange={(e) =>
                          profile(
                            "weightKg",
                            e.target.value === ""
                              ? undefined
                              : Number(e.target.value),
                          )
                        }
                        aria-invalid={Boolean(fieldErrors.weightKg)}
                      />
                      {fieldError("weightKg")}
                    </label>
                    {selectField("goal", "Primary dietary goal", goals)}
                    {selectField("diet", "Dietary preference", diets)}
                  </div>
                  <fieldset className="avoid">
                    <legend>Foods avoided</legend>
                    <div className="choice-grid">
                      {avoidanceOptions.map((a) => (
                        <label className="check choice" key={a}>
                          <input
                            type="checkbox"
                            checked={
                              draft.profile.avoided?.includes(a) || false
                            }
                            onChange={(e) => {
                              const previous = draft.profile.avoided || [];
                              const avoided = e.target.checked
                                ? a === "None"
                                  ? ["None" as const]
                                  : [...previous.filter((x) => x !== "None"), a]
                                : previous.filter((x) => x !== a);
                              setDraft((d) => ({
                                ...d,
                                accurate: false,
                                profile: {
                                  ...d.profile,
                                  avoided,
                                  otherAvoided: avoided.includes("Other")
                                    ? d.profile.otherAvoided
                                    : "",
                                },
                              }));
                            }}
                          />
                          {a}
                        </label>
                      ))}
                    </div>
                    {fieldError("avoided")}
                  </fieldset>
                  {draft.profile.avoided?.includes("Other") && (
                    <label>
                      Other foods avoided
                      <input
                        value={draft.profile.otherAvoided}
                        maxLength={200}
                        onChange={(e) =>
                          profile("otherAvoided", e.target.value)
                        }
                      />
                      {fieldError("otherAvoided")}
                    </label>
                  )}
                  <div className="field-grid optional">
                    {selectField(
                      "pattern",
                      "Dietary pattern (optional)",
                      patterns,
                    )}
                    {selectField(
                      "activity",
                      "Activity level (optional)",
                      activities,
                    )}
                  </div>
                </>
              )}
              {step === 2 && (
                <>
                  <p className="lead">Think of an ordinary day.</p>
                  <div className="instruction-list">
                    <p>
                      <span>01</span>Please describe what you would normally eat
                      and drink on a typical day, rather than a special occasion
                      or an unusually different day.
                    </p>
                    <p>
                      <span>02</span>Include foods, snacks, tea, coffee, milk,
                      juices, and other calorie-containing beverages.
                    </p>
                    <p>
                      <span>03</span>Select the closest matching food from the
                      list and enter the amount normally consumed.
                    </p>
                    <p>
                      <span>04</span>Do not change your answers based on what
                      you think is healthy. We are interested in your existing
                      habits.
                    </p>
                  </div>
                  <label>
                    How representative is this day?
                    <select
                      value={draft.dayRepresentativeness}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          accurate: false,
                          dayRepresentativeness: e.target.value,
                        }))
                      }
                    >
                      <option value="">Select an option</option>
                      {typicalOptions.map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <label className="optional">
                    Day type
                    <select
                      value={draft.dayType}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          accurate: false,
                          dayType: e.target.value,
                        }))
                      }
                    >
                      <option value="">Select an option</option>
                      {dayOptions.map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              {step >= 3 && step <= 6 && (
                <>
                  <p className="lead">
                    What do you usually have for{" "}
                    {mealLabels[mealKeys[step - 3]].toLowerCase()}?
                  </p>
                  <p className="muted">
                    Add each food and drink, including accompaniments. Household
                    units come from the food dataset.
                  </p>
                  <FoodEditor
                    key={step}
                    foods={catalog?.foods || []}
                    value={draft.meals[mealKeys[step - 3]]}
                    onChange={(meal) =>
                      setDraft((d) => ({
                        ...d,
                        accurate: false,
                        meals: { ...d.meals, [mealKeys[step - 3]]: meal },
                      }))
                    }
                  />
                </>
              )}
              {step === 7 && (
                <>
                  <p className="lead">Does this look like your usual day?</p>
                  <p className="muted">
                    Please review your answers. You can edit any section before
                    submitting.
                  </p>
                  <section className="review-block">
                    <div className="review-title">
                      <h3>Personal profile</h3>
                      <button
                        className="text-button"
                        onClick={() => navigate(1)}
                      >
                        Edit profile
                      </button>
                    </div>
                    <p>
                      {age} years ·{" "}
                      {draft.profile.sex === "male" ? "Male" : "Female"} ·{" "}
                      {draft.profile.heightCm} cm · {draft.profile.weightKg} kg
                    </p>
                    <p>
                      {draft.profile.goal} · {draft.profile.diet}
                    </p>
                    <p>
                      Foods avoided: {draft.profile.avoided?.join(", ")}{" "}
                      {draft.profile.otherAvoided}
                    </p>
                    <p>
                      {draft.profile.pattern || "Dietary pattern not specified"}{" "}
                      · {draft.profile.activity || "Activity not specified"}
                    </p>
                  </section>
                  <section className="review-block">
                    <div className="review-title">
                      <h3>Your typical day</h3>
                      <button
                        className="text-button"
                        onClick={() => navigate(2)}
                      >
                        Edit day
                      </button>
                    </div>
                    <p>
                      {draft.dayRepresentativeness} · {draft.dayType}
                    </p>
                  </section>
                  {mealKeys.map((m, i) => (
                    <section className="review-block" key={m}>
                      <div className="review-title">
                        <h3>{mealLabels[m]}</h3>
                        <button
                          className="text-button"
                          onClick={() => navigate(i + 3)}
                        >
                          Edit {mealLabels[m].toLowerCase()}
                        </button>
                      </div>
                      {draft.meals[m].skipped ? (
                        <p className="muted">Usually skipped</p>
                      ) : (
                        <ul className="review-foods">
                          {draft.meals[m].entries.map((f, j) => (
                            <li key={j}>
                              <span>
                                {f.name}
                                {f.source === "CUSTOM" && (
                                  <small>
                                    Custom food{f.brand && ` · ${f.brand}`}
                                    {f.preparation && ` · ${f.preparation}`}
                                  </small>
                                )}
                              </span>
                              <strong>
                                {f.quantity} × {f.unit}
                              </strong>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  ))}
                  <label className="check confirm-check">
                    <input
                      type="checkbox"
                      checked={draft.accurate}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, accurate: e.target.checked }))
                      }
                    />
                    I confirm that these answers describe my usual eating habits
                    as accurately as I can remember.
                  </label>
                </>
              )}
              {error && (
                <p className="error error-box" role="alert">
                  {error}
                </p>
              )}
              {storageError && (
                <p className="notice" role="status">
                  This browser cannot save your draft. Keep this tab open until
                  you finish.
                </p>
              )}
              <nav className="navigation" aria-label="Questionnaire navigation">
                {step > 0 ? (
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => navigate(step - 1)}
                  >
                    <ArrowLeft size={17} />
                    Back
                  </button>
                ) : (
                  <span className="muted">
                    Your participation is voluntary.
                  </span>
                )}
                {step < 7 ? (
                  <button
                    className="primary"
                    onClick={next}
                    disabled={
                      step === 0 && (!policy || !catalog || Boolean(setupError))
                    }
                  >
                    {step === 0 ? "Begin questionnaire" : "Continue"}
                    <ArrowRight size={17} />
                  </button>
                ) : (
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => void submit()}
                  >
                    {busy ? "Submitting…" : "Submit Response"}
                    <ArrowRight size={17} />
                  </button>
                )}
              </nav>
              <div className="draft-footer">
                <span>
                  {minor
                    ? "Answers kept in this tab only"
                    : "Draft saved on this device after consent"}
                </span>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Discard all answers saved on this device? This cannot be undone.",
                      )
                    ) {
                      try {
                        localStorage.removeItem(DRAFT_KEY);
                      } catch {
                        setStorageError(true);
                      }
                      setDraft(blankDraft());
                      setGuardian({ uid: "", verified: false });
                      navigate(0);
                    }
                  }}
                >
                  Discard draft
                </button>
              </div>
            </section>
          </div>
        )}
      </main>
      <footer>
        Developed for academic research on personalized nutritional optimization
        of Indian diets.
      </footer>
    </>
  );
}
