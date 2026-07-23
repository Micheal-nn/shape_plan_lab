import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { generatePlan } from "../src/planEngine.js";

const goals = ["fat_loss", "muscle_gain", "recomposition", "maintain"];
const sexes = ["male", "female"];
const modes = ["gym", "bodyweight"];
const frequencies = [2, 3, 4, 5, 6];
const focusCases = [
  { name: "none", current: {}, target: {} },
  { name: "waist", current: { waistCm: 91 }, target: { waistCm: 86 }, groups: ["core"] },
  { name: "chest", current: { chestCm: 100 }, target: { chestCm: 104 }, groups: ["chest"] },
  { name: "arm", current: { armCm: 34 }, target: { armCm: 36 }, groups: ["biceps", "triceps"] },
  { name: "thigh", current: { thighCm: 57 }, target: { thighCm: 60 }, groups: ["quads"] },
  { name: "hip", current: { hipCm: 98 }, target: { hipCm: 101 }, groups: ["glutes"] }
];

const targetWeightByGoal = {
  fat_loss: 74,
  muscle_gain: 86,
  recomposition: 81,
  maintain: 82
};

function webInput({ sex, goal, mode, frequency, focus }) {
  return {
    sex,
    age: 30,
    heightCm: sex === "male" ? 175 : 165,
    weightKg: 82,
    bodyFatPct: sex === "male" ? 24 : 31,
    activityLevel: "light",
    goal: { type: goal, targetDate: "2026-12-31", targetWeightKg: targetWeightByGoal[goal] },
    trainingMode: mode,
    frequencyPerWeek: frequency,
    sessionMinutes: 60,
    trainingExperience: "intermediate",
    currentCircumference: focus.current,
    goalCircumference: focus.target
  };
}

test("web plan engine responds across sex, goal, mode, frequency, and circumference scenarios", () => {
  let checked = 0;
  for (const sex of sexes) {
    for (const goal of goals) {
      for (const mode of modes) {
        for (const frequency of frequencies) {
          for (const focus of focusCases) {
            const plan = generatePlan(webInput({ sex, goal, mode, frequency, focus }));
            checked += 1;

            assert.equal(plan.trainingPlan.workouts.length, frequency, `${sex}/${goal}/${mode}/${frequency}/${focus.name} should return requested days`);
            assert.ok(plan.trainingPlan.workouts.every((workout) => workout.exercises.length >= 4 && workout.exercises.length <= 6));
            assert.ok(plan.targets.dailyCalories > 1000);
            assert.ok(plan.targets.proteinG > 0);
            assert.ok(plan.targets.carbG >= 80);

            const exercises = plan.trainingPlan.workouts.flatMap((workout) => workout.exercises);
            assert.ok(exercises.every((exercise) => exercise.mode === mode || exercise.mode === "both"), `${mode} plan includes an incompatible exercise`);

            const maintenanceCalories = generatePlan(webInput({ sex, goal: "maintain", mode, frequency, focus: focus.name === "waist" ? focusCases[0] : focus })).targets.dailyCalories;
            if (goal === "fat_loss") assert.ok(plan.targets.dailyCalories < maintenanceCalories);
            if (goal === "muscle_gain") assert.ok(plan.targets.dailyCalories > maintenanceCalories);
            if (goal === "maintain" && focus.name !== "waist") assert.equal(plan.targets.dailyCalories, maintenanceCalories);

            if (mode === "gym" && sex === "male") assert.ok(exercises.some((exercise) => exercise.id === "bench_press"));
            if (mode === "gym" && sex === "female") assert.ok(exercises.some((exercise) => exercise.id === "db_press"));
            if (mode === "bodyweight") assert.ok(exercises.some((exercise) => exercise.id === "push_up"));

            for (const group of focus.groups ?? []) {
              assert.ok(exercises.some((exercise) => exercise.muscleGroup === group && exercise.emphasis), `${focus.name} should emphasize ${group}`);
            }
          }
        }
      }
    }
  }
  assert.equal(checked, sexes.length * goals.length * modes.length * frequencies.length * focusCases.length);
});

function createElement(id) {
  return {
    id,
    value: "",
    textContent: "",
    hidden: false,
    innerHTML: "",
    firstChild: { textContent: "" },
    classList: { add() {}, remove() {} },
    addEventListener() {},
    scrollIntoView() {},
    options: []
  };
}

function option(value) {
  return { value, textContent: value };
}

function loadAndroidContext() {
  const html = fs.readFileSync("android/shape-plan-android/app/src/main/assets/index.html", "utf8");
  const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
  const ids = [
    "title", "subtitle", "profileTitle", "sexLabel", "ageLabel", "heightLabel", "weightLabel", "fatLabel", "activityLabel",
    "goalLabel", "targetWeightLabel", "targetDateLabel", "frequencyLabel", "sessionLabel", "modeLabel", "experienceLabel",
    "circTitle", "circHint", "areaHead", "currentHead", "targetHead", "waistName", "chestName", "hipName", "armName", "thighName",
    "prTitle", "prHint", "benchLabel", "squatLabel", "rowLabel", "hingeLabel", "generate", "result", "feedback", "form", "lang",
    "sex", "age", "height", "weight", "fat", "activity", "goal", "targetWeight", "targetDate", "frequency", "session", "mode", "experience",
    "waist", "targetWaist", "chest", "targetChest", "hip", "targetHip", "arm", "targetArm", "thigh", "targetThigh",
    "benchWeight", "benchReps", "squatWeight", "squatReps", "rowWeight", "rowReps", "hingeWeight", "hingeReps"
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, createElement(id)]));
  elements.sex.options = sexes.map(option);
  elements.activity.options = ["sedentary", "light", "moderate", "high"].map(option);
  elements.goal.options = goals.map(option);
  elements.mode.options = modes.map(option);
  elements.experience.options = ["novice", "intermediate", "advanced"].map(option);
  elements.frequency.options = frequencies.map((value) => option(String(value)));

  const context = {
    console,
    Date,
    Math,
    Number,
    String,
    Blob: class Blob {},
    URL: { createObjectURL() { return "blob:test"; }, revokeObjectURL() {} },
    window: {},
    document: {
      documentElement: { lang: "zh-CN" },
      title: "",
      createElement: () => ({ click() {}, set href(value) { this._href = value; }, set download(value) { this._download = value; } }),
      getElementById: (id) => elements[id] ?? (elements[id] = createElement(id)),
      querySelectorAll: () => []
    }
  };
  vm.createContext(context);
  vm.runInContext(script, context, { filename: "android-index.html" });
  return { context, elements };
}

function setAndroidInput(elements, { sex, goal, mode, frequency, focus }) {
  const values = {
    sex,
    age: "30",
    height: sex === "male" ? "175" : "165",
    weight: "82",
    fat: sex === "male" ? "24" : "31",
    activity: "light",
    goal,
    targetWeight: String(targetWeightByGoal[goal]),
    targetDate: "2026-12-31",
    frequency: String(frequency),
    session: "60",
    mode,
    experience: "intermediate",
    waist: focus.current.waistCm ? String(focus.current.waistCm) : "",
    targetWaist: focus.target.waistCm ? String(focus.target.waistCm) : "",
    chest: focus.current.chestCm ? String(focus.current.chestCm) : "",
    targetChest: focus.target.chestCm ? String(focus.target.chestCm) : "",
    hip: focus.current.hipCm ? String(focus.current.hipCm) : "",
    targetHip: focus.target.hipCm ? String(focus.target.hipCm) : "",
    arm: focus.current.armCm ? String(focus.current.armCm) : "",
    targetArm: focus.target.armCm ? String(focus.target.armCm) : "",
    thigh: focus.current.thighCm ? String(focus.current.thighCm) : "",
    targetThigh: focus.target.thighCm ? String(focus.target.thighCm) : "",
    benchWeight: "", benchReps: "", squatWeight: "", squatReps: "", rowWeight: "", rowReps: "", hingeWeight: "", hingeReps: ""
  };
  for (const [id, value] of Object.entries(values)) elements[id].value = value;
}

test("Android WebView planner keeps scenario-sensitive outputs aligned with the web MVP", () => {
  const { context, elements } = loadAndroidContext();
  const gymOnly = /杠铃|哑铃|绳索|高位下拉|动感单车|器械|Cable|Dumbbell|Barbell|Lat pulldown|bike/;
  let checked = 0;

  for (const sex of sexes) {
    for (const goal of goals) {
      for (const mode of modes) {
        for (const frequency of frequencies) {
          for (const focus of focusCases) {
            setAndroidInput(elements, { sex, goal, mode, frequency, focus });
            const input = context.normalizeInput();
            const plan = context.buildPlan(input);
            checked += 1;

            assert.equal(plan.workouts.length, frequency, `${sex}/${goal}/${mode}/${frequency}/${focus.name} should return requested days`);
            assert.ok(plan.workouts.every((workout) => workout.blocks.length >= 5 && workout.blocks.length <= 6));
            assert.ok(plan.calories > 1000);
            assert.ok(plan.protein > 0);

            const actionText = plan.workouts.flatMap((day) => day.blocks.map((block) => block.name)).join(" ");
            if (mode === "bodyweight") assert.doesNotMatch(actionText, gymOnly, `home plan includes gym-only action: ${actionText}`);
            if (mode === "gym" && sex === "male") assert.match(plan.workouts[0].blocks[0].name, /杠铃卧推|Barbell bench press/);
            if (mode === "gym" && sex === "female") assert.match(plan.workouts[0].blocks[0].name, /上斜哑铃推举|Incline dumbbell press/);
            if (goal === "fat_loss") assert.ok(plan.calories < context.buildPlan({ ...input, goal: { ...input.goal, type: "maintain", targetWeightKg: 82 } }).calories);
            if (goal === "muscle_gain") assert.ok(plan.calories > context.buildPlan({ ...input, goal: { ...input.goal, type: "maintain", targetWeightKg: 82 } }).calories);
          }
        }
      }
    }
  }
  assert.equal(checked, sexes.length * goals.length * modes.length * frequencies.length * focusCases.length);
});
