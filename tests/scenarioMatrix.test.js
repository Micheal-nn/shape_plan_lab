import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { generatePlan } from "../src/planEngine.js";

const goals = ["fat_loss", "muscle_gain", "recomposition", "maintain"];
const sexes = ["male", "female"];
const modes = ["gym", "bodyweight"];
const frequencies = [1, 2, 3, 4, 5, 6];
const activityLevels = ["sedentary", "light", "moderate", "high"];
const trainingExperiences = ["novice", "intermediate", "advanced"];
const sessionLengths = [20, 60, 180];
const webPrProfiles = [
  { name: "no-pr" },
  { name: "with-pr", benchWeight: 75, benchReps: 10, squatWeight: 100, squatReps: 8, rowWeight: 60, rowReps: 10, hingeWeight: 110, hingeReps: 6 }
];
const androidPrProfiles = [
  { name: "no-pr" },
  { name: "with-pr", benchWeight: "75", benchReps: "10", squatWeight: "100", squatReps: "8", rowWeight: "60", rowReps: "10", hingeWeight: "110", hingeReps: "6" }
];
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

function webInput({ sex, goal, mode, frequency, focus, activityLevel = "light", trainingExperience = "intermediate", sessionMinutes = 60, pr = {} }) {
  return {
    sex,
    age: 30,
    heightCm: sex === "male" ? 175 : 165,
    weightKg: 82,
    bodyFatPct: sex === "male" ? 24 : 31,
    activityLevel,
    goal: { type: goal, targetDate: "2026-12-31", targetWeightKg: targetWeightByGoal[goal] },
    trainingMode: mode,
    frequencyPerWeek: frequency,
    sessionMinutes,
    trainingExperience,
    currentCircumference: focus.current,
    goalCircumference: focus.target,
    pr
  };
}

test("web plan engine responds across sex, goal, mode, frequency, and circumference scenarios", () => {
  let checked = 0;
  for (const sex of sexes) {
    for (const goal of goals) {
      for (const mode of modes) {
        for (const frequency of frequencies) {
          for (const focus of focusCases) {
            for (const activityLevel of activityLevels) {
              for (const trainingExperience of trainingExperiences) {
                for (const sessionMinutes of sessionLengths) {
                  for (const pr of webPrProfiles) {
                    const params = { sex, goal, mode, frequency, focus, activityLevel, trainingExperience, sessionMinutes, pr: pr.name === "with-pr" ? { bench: { weightKg: 75, reps: 10 }, squat: { weightKg: 100, reps: 8 }, row: { weightKg: 60, reps: 10 }, hinge: { weightKg: 110, reps: 6 } } : {} };
                    const plan = generatePlan(webInput(params));
                    checked += 1;

                    assert.equal(plan.trainingPlan.workouts.length, frequency, `${sex}/${goal}/${mode}/${frequency}/${focus.name}/${activityLevel}/${trainingExperience}/${sessionMinutes} should return requested days`);
                    assert.ok(plan.trainingPlan.workouts.every((workout) => workout.exercises.length >= 4 && workout.exercises.length <= 6));
                    assert.ok(plan.targets.dailyCalories > 1000);
                    assert.ok(plan.targets.proteinG > 0);
                    assert.ok(plan.targets.carbG >= 80);
                    assert.ok(plan.intensityPlan.rpe.length > 0);
                    assert.ok(plan.rationale.length >= 5);
                    assert.ok(plan.planningLogic.evidenceBasis.length >= 4);

                    const exercises = plan.trainingPlan.workouts.flatMap((workout) => workout.exercises);
                    assert.ok(exercises.every((exercise) => exercise.mode === mode || exercise.mode === "both"), `${mode} plan includes an incompatible exercise`);

                    const maintenanceCalories = generatePlan(webInput({ ...params, goal: "maintain", focus: focus.name === "waist" ? focusCases[0] : focus, pr: {} })).targets.dailyCalories;
                    if (goal === "fat_loss") assert.ok(plan.targets.dailyCalories < maintenanceCalories);
                    if (goal === "muscle_gain") assert.ok(plan.targets.dailyCalories > maintenanceCalories);
                    if (goal === "maintain" && focus.name !== "waist") assert.equal(plan.targets.dailyCalories, maintenanceCalories);

                    if (mode === "gym" && sex === "male") assert.ok(exercises.some((exercise) => exercise.id === "bench_press"));
                    if (mode === "gym" && sex === "female") assert.ok(exercises.some((exercise) => exercise.id === "db_press"));
                    if (mode === "bodyweight") assert.ok(exercises.some((exercise) => exercise.id === "push_up"));

                    for (const group of focus.groups ?? []) {
                      assert.ok(exercises.some((exercise) => exercise.muscleGroup === group && exercise.emphasis), `${focus.name} should emphasize ${group}`);
                    }

                    if (pr.name === "with-pr" && mode === "gym" && sex === "male" && goal === "muscle_gain" && frequency === 4 && focus.name === "none" && activityLevel === "light" && trainingExperience === "intermediate" && sessionMinutes === 60) {
                      const firstDay = exercises.filter((exercise) => exercise.nameZh).slice(0, 4);
                      const loads = firstDay.map((exercise) => exercise.load?.labelZh ?? "");
                      assert.ok(loads.some((load) => load.includes("67.5 kg")), "bench load should round to 67.5 kg");
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  assert.equal(checked, sexes.length * goals.length * modes.length * frequencies.length * focusCases.length * activityLevels.length * trainingExperiences.length * sessionLengths.length * webPrProfiles.length);
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

function setAndroidInput(elements, { sex, goal, mode, frequency, focus, activityLevel = "light", trainingExperience = "intermediate", sessionMinutes = 60, prProfile = androidPrProfiles[0] }) {
  const values = {
    sex,
    age: "30",
    height: sex === "male" ? "175" : "165",
    weight: "82",
    fat: sex === "male" ? "24" : "31",
    activity: activityLevel,
    goal,
    targetWeight: String(targetWeightByGoal[goal]),
    targetDate: "2026-12-31",
    frequency: String(frequency),
    session: String(sessionMinutes),
    mode,
    experience: trainingExperience,
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
    benchWeight: prProfile.benchWeight ?? "", benchReps: prProfile.benchReps ?? "",
    squatWeight: prProfile.squatWeight ?? "", squatReps: prProfile.squatReps ?? "",
    rowWeight: prProfile.rowWeight ?? "", rowReps: prProfile.rowReps ?? "",
    hingeWeight: prProfile.hingeWeight ?? "", hingeReps: prProfile.hingeReps ?? ""
  };
  for (const [id, value] of Object.entries(values)) elements[id].value = value;
}

function kgFromLoad(load) {
  const text = String(load);
  if (/RPE|用力等级/.test(text)) return null;
  const match = text.match(/([\d.]+)\s*kg/);
  return match ? Number(match[1]) : null;
}

function maxReasonableKg(block) {
  const name = `${block.name} ${block.tag}`;
  if (/无外部负重|自重|Bodyweight|No external load/.test(block.load)) return 0;
  if (/侧平举|lateral raise/i.test(name)) return 20;
  if (/弯举|curl/i.test(name)) return 35;
  if (/下压|pushdown|triceps/i.test(name)) return 45;
  if (/飞鸟|夹胸|fly|pec deck/i.test(name)) return 45;
  if (/肩推|shoulder press|Seated shoulder/i.test(name)) return 70;
  if (/高脚杯|goblet/i.test(name)) return 60;
  if (/保加利亚|弓步|split squat|lunge/i.test(name)) return 70;
  if (/腿弯举|leg curl/i.test(name)) return 70;
  if (/提踵|calf/i.test(name)) return 120;
  if (/臀推|hip thrust/i.test(name)) return 180;
  if (/划船|row|下拉|pulldown/i.test(name)) return 140;
  if (/卧推|bench|深蹲|squat|硬拉|deadlift|Romanian/i.test(name)) return 200;
  return 140;
}

function assertAndroidWorkoutPrescription(plan, scenario) {
  for (const day of plan.workouts) {
    assert.ok(day.title.length > 0, `${scenario}: day title missing`);
    assert.ok(day.reason.length > 0, `${scenario}: day reason missing`);
    for (const block of day.blocks) {
      assert.ok(block.name.length > 0, `${scenario}: action name missing`);
      assert.ok(block.guide.length > 0, `${scenario}: ${block.name} guide missing`);
      assert.ok(Number.isInteger(block.sets) && block.sets >= 1 && block.sets <= 5, `${scenario}: ${block.name} invalid sets ${block.sets}`);
      assert.ok(String(block.reps).length > 0, `${scenario}: ${block.name} reps missing`);
      assert.ok(String(block.load).length > 0, `${scenario}: ${block.name} load missing`);
      assert.ok(String(block.prBasis).length > 0, `${scenario}: ${block.name} PR basis missing`);
      assert.ok(String(block.reason).length > 0, `${scenario}: ${block.name} reason missing`);
      assert.match(String(block.load), /(\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?\s*kg\s*\/\s*\d+(?:-\d+)?\s*lb|RPE|用力等级)/, `${scenario}: ${block.name} load must include kg/lb or RPE`);
      const kg = kgFromLoad(block.load);
      if (kg !== null) {
        assert.ok(Number.isFinite(kg) && kg >= 0, `${scenario}: ${block.name} invalid kg ${block.load}`);
        assert.ok(kg <= maxReasonableKg(block), `${scenario}: ${block.name} load ${kg}kg exceeds cap ${maxReasonableKg(block)}kg`);
      }
    }
  }
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
            for (const activityLevel of activityLevels) {
              for (const trainingExperience of trainingExperiences) {
                for (const sessionMinutes of sessionLengths) {
                  for (const prProfile of androidPrProfiles) {
                    setAndroidInput(elements, { sex, goal, mode, frequency, focus, activityLevel, trainingExperience, sessionMinutes, prProfile });
                    const input = context.normalizeInput();
                    const plan = context.buildPlan(input);
                    const scenario = `${sex}/${goal}/${mode}/${frequency}/${focus.name}/${activityLevel}/${trainingExperience}/${sessionMinutes}/${prProfile.name}`;
                    checked += 1;

                    assert.equal(plan.workouts.length, frequency, `${scenario} should return requested days`);
                    assert.ok(plan.workouts.every((workout) => workout.blocks.length >= 5 && workout.blocks.length <= 6));
                    assert.ok(plan.calories > 1000);
                    assert.ok(plan.protein > 0);
                    assert.ok(plan.logicSections.length >= 5);
                    assert.ok(plan.scienceSections.length >= 4);
                    assert.ok(plan.reasonSections.length >= 3);
                    assertAndroidWorkoutPrescription(plan, scenario);

                    const actionText = plan.workouts.flatMap((day) => day.blocks.map((block) => block.name)).join(" ");
                    if (mode === "bodyweight") assert.doesNotMatch(actionText, gymOnly, `home plan includes gym-only action: ${actionText}`);
                    if (mode === "gym" && sex === "male") assert.match(actionText, /杠铃卧推|Barbell bench press/);
                    if (mode === "gym" && sex === "female") assert.match(actionText, /哑铃卧推|上斜哑铃推举|Dumbbell press|Incline dumbbell press/);
                    if (focus.name === "arm") assert.match(actionText, /弯举|下压|窄距俯卧撑|curl|pushdown|Close-grip push-up/i);
                    if (focus.name === "hip") assert.match(actionText, /臀|Glute|Hip/i);
                    if (focus.name === "thigh") assert.match(actionText, /深蹲|弓步|Squat|lunge/i);
                    if (goal === "fat_loss") assert.ok(plan.calories < context.buildPlan({ ...input, goal: { ...input.goal, type: "maintain", targetWeightKg: 82 } }).calories);
                    if (goal === "muscle_gain") assert.ok(plan.calories > context.buildPlan({ ...input, goal: { ...input.goal, type: "maintain", targetWeightKg: 82 } }).calories);
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  assert.equal(checked, sexes.length * goals.length * modes.length * frequencies.length * focusCases.length * activityLevels.length * trainingExperiences.length * sessionLengths.length * androidPrProfiles.length);
});

test("Android PR loads use conservative safe max and movement-specific scaling", () => {
  const { context, elements } = loadAndroidContext();
  setAndroidInput(elements, { sex: "male", goal: "muscle_gain", mode: "gym", frequency: 4, focus: focusCases[0] });
  elements.benchWeight.value = "75";
  elements.benchReps.value = "10";
  const input = context.normalizeInput();
  const plan = context.buildPlan(input);
  const pushDay = plan.workouts[0];
  const loadKg = (namePart) => {
    const block = pushDay.blocks.find((item) => item.name.includes(namePart));
    assert.ok(block, `${namePart} should be present`);
    return Number(block.load.match(/^([\d.]+)/)?.[1]);
  };

  assert.equal(input.pr.bench, 84);
  assert.ok(plan.prSummary[0].reason.includes("保守安全训练最大值") || plan.prSummary[0].reason.includes("safe training max"));
  assert.equal(loadKg("杠铃卧推"), 67.5);
  assert.equal(loadKg("坐姿肩推"), 20);
  assert.equal(loadKg("下压"), 10);
  assert.equal(loadKg("侧平举"), 5);
});

test("Android long-image export keeps only goal, workouts, and plan logic with dynamic height", () => {
  const { context, elements } = loadAndroidContext();
  setAndroidInput(elements, { sex: "male", goal: "fat_loss", mode: "gym", frequency: 6, focus: focusCases[1], prProfile: androidPrProfiles[1] });
  const input = context.normalizeInput();
  const plan = context.buildPlan(input);
  const data = context.buildLongImageData(plan, input);
  const text = data.rows.map((row) => row.text).join("\n");

  assert.match(text, /目标/);
  assert.match(text, /训练/);
  assert.match(text, /计划生成逻辑/);
  assert.match(text, /腰围: 91 cm -> 86 cm/);
  assert.match(text, /杠铃卧推|坐姿肩推|深蹲|高位下拉/);
  assert.doesNotMatch(text, /科学依据|为什么这样安排|训练强度处方|蛋白|碳水|脂肪/);
  assert.match(data.svg, /fill="#173224"/);
  assert.match(data.svg, /rx="26"/);
  assert.ok(data.height > 760);

  const expandedPlan = { ...plan, workouts: Array.from({ length: 24 }, (_, index) => ({ ...plan.workouts[index % plan.workouts.length], title: `第${index + 1}天` })) };
  const expandedData = context.buildLongImageData(expandedPlan, input);
  assert.ok(expandedData.height > data.height * 2, "export image height should grow with content instead of clipping to a fixed cap");
});

test("Android native bridge saves the exported image into the gallery image store", () => {
  const source = fs.readFileSync("android/shape-plan-android/app/src/main/java/com/shapeplanlab/app/MainActivity.java", "utf8");
  assert.match(source, /void saveImage\(String dataUrl, String fileName\)/);
  assert.match(source, /MediaStore\.Images\.Media\.EXTERNAL_CONTENT_URI/);
  assert.match(source, /Environment\.DIRECTORY_PICTURES \+ "\/ShapePlanLab"/);
  assert.match(source, /image\/png/);
  assert.doesNotMatch(source, /saveSvg/);
  assert.doesNotMatch(source, /MediaStore\.Downloads/);
});
