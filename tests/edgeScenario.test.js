import test from "node:test";
import assert from "node:assert/strict";
import { validateGeneratePlanInput } from "../src/validators.js";
import { normalizeGoalInput } from "../src/goalNormalizer.js";
import { generatePlan } from "../src/planEngine.js";

function futureDate(days = 120) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function base(overrides = {}) {
  return {
    sex: "male",
    age: 30,
    heightCm: 175,
    weightKg: 82,
    bodyFatPct: 24,
    activityLevel: "light",
    goal: { type: "fat_loss", targetDate: futureDate(), targetWeightKg: 76, targetBodyFatPct: 18 },
    trainingMode: "gym",
    frequencyPerWeek: 4,
    sessionMinutes: 60,
    trainingExperience: "intermediate",
    currentCircumference: {},
    goalCircumference: {},
    ...overrides
  };
}

test("validator rejects malformed or unsafe boundary inputs", () => {
  const cases = [
    ["sex", base({ sex: "other" })],
    ["age", base({ age: 12 })],
    ["heightCm", base({ heightCm: 119 })],
    ["weightKg", base({ weightKg: 301 })],
    ["bodyFatPct", base({ bodyFatPct: 61 })],
    ["trainingMode", base({ trainingMode: "parkour" })],
    ["frequencyPerWeek", base({ frequencyPerWeek: 7 })],
    ["sessionMinutes", base({ sessionMinutes: 181 })],
    ["targetDate", base({ goal: { type: "fat_loss", targetDate: "2020-01-01", targetWeightKg: 76 } })],
    ["goal", base({ goal: { type: "fat_loss", targetDate: futureDate() } })],
    ["currentCircumference.waistCm", base({ currentCircumference: {}, goalCircumference: { waistCm: 80 } })]
  ];

  for (const [field, input] of cases) {
    const errors = validateGeneratePlanInput(input);
    assert.ok(errors?.some((error) => error.field === field || error.field.startsWith(`${field}.`)), `${field} should be rejected`);
  }
});

test("goal normalizer resolves contradictory and extreme user targets", () => {
  const muscleWithLowerWeight = normalizeGoalInput(base({
    goal: { type: "muscle_gain", targetDate: futureDate(180), targetWeightKg: 70, targetBodyFatPct: 18 }
  }));
  assert.equal(muscleWithLowerWeight.input.goal.type, "fat_loss");
  assert.ok(muscleWithLowerWeight.adjustments.some((item) => item.field === "goal.type"));

  const muscleWithLowerBodyFat = normalizeGoalInput(base({
    goal: { type: "muscle_gain", targetDate: futureDate(180), targetWeightKg: 83, targetBodyFatPct: 18 }
  }));
  assert.equal(muscleWithLowerBodyFat.input.goal.type, "recomposition");

  const maintainWithBigChange = normalizeGoalInput(base({
    goal: { type: "maintain", targetDate: futureDate(180), targetWeightKg: 70, targetBodyFatPct: 12 }
  }));
  assert.equal(maintainWithBigChange.input.goal.type, "fat_loss");

  const circumference = normalizeGoalInput(base({
    currentCircumference: { waistCm: 90, armCm: 34 },
    goalCircumference: { waistCm: 120, armCm: 20 }
  }));
  assert.ok(circumference.input.goalCircumference.waistCm < 90);
  assert.ok(circumference.input.goalCircumference.armCm > 34);
  assert.ok(circumference.adjustments.some((item) => item.field === "goalCircumference.waistCm"));
  assert.ok(circumference.adjustments.some((item) => item.field === "goalCircumference.armCm"));
});

test("one-session frequency returns one full-body plan instead of silently expanding to two days", () => {
  const plan = generatePlan(base({ frequencyPerWeek: 1, trainingMode: "bodyweight" }));
  assert.equal(plan.trainingPlan.days, 1);
  assert.equal(plan.trainingPlan.workouts.length, 1);
  assert.equal(plan.trainingPlan.split, "full_body_1d");
  assert.ok(plan.trainingPlan.workouts[0].exercises.some((exercise) => exercise.muscleGroup === "chest"));
  assert.ok(plan.trainingPlan.workouts[0].exercises.some((exercise) => exercise.muscleGroup === "quads"));
  assert.ok(plan.trainingPlan.workouts[0].exercises.some((exercise) => exercise.muscleGroup === "back"));
});

test("activity level changes maintenance calories monotonically", () => {
  const input = base({ goal: { type: "maintain", targetDate: futureDate(180), targetWeightKg: 82 }, frequencyPerWeek: 3 });
  const sedentary = generatePlan({ ...input, activityLevel: "sedentary" }).targets.dailyCalories;
  const light = generatePlan({ ...input, activityLevel: "light" }).targets.dailyCalories;
  const moderate = generatePlan({ ...input, activityLevel: "moderate" }).targets.dailyCalories;
  const high = generatePlan({ ...input, activityLevel: "high" }).targets.dailyCalories;
  assert.ok(sedentary < light);
  assert.ok(light < moderate);
  assert.ok(moderate < high);
});

test("session duration edges keep plans finite and emit short-session warning", () => {
  const short = generatePlan(base({ sessionMinutes: 20, frequencyPerWeek: 2 }));
  const long = generatePlan(base({ sessionMinutes: 180, frequencyPerWeek: 6 }));
  assert.ok(short.warnings.some((warning) => /Short sessions/.test(warning)));
  assert.equal(short.trainingPlan.workouts.length, 2);
  assert.equal(long.trainingPlan.workouts.length, 6);
  assert.ok(Number.isFinite(short.targets.dailyCalories));
  assert.ok(Number.isFinite(long.targets.dailyCalories));
});
