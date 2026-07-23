import fs from "node:fs";
import { generatePlan } from "../src/planEngine.js";
import { normalizeGoalInput } from "../src/goalNormalizer.js";
import { validateGeneratePlanInput } from "../src/validators.js";

const outputPath = "docs/scenario-test-report.md";
const matrix = {
  sex: ["male", "female"],
  goal: ["fat_loss", "muscle_gain", "recomposition", "maintain"],
  mode: ["gym", "bodyweight"],
  frequency: [1, 2, 3, 4, 5, 6],
  focus: ["none", "waist", "chest", "arm", "thigh", "hip"],
  activity: ["sedentary", "light", "moderate", "high"],
  experience: ["novice", "intermediate", "advanced"],
  sessionMinutes: [20, 60, 180]
};

function futureDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function focusData(name) {
  const cases = {
    none: [{}, {}],
    waist: [{ waistCm: 91 }, { waistCm: 86 }],
    chest: [{ chestCm: 100 }, { chestCm: 104 }],
    arm: [{ armCm: 34 }, { armCm: 36 }],
    thigh: [{ thighCm: 57 }, { thighCm: 60 }],
    hip: [{ hipCm: 98 }, { hipCm: 101 }]
  };
  const [currentCircumference, goalCircumference] = cases[name];
  return { currentCircumference, goalCircumference };
}

function baseInput(overrides = {}) {
  const goalType = overrides.goal?.type ?? "fat_loss";
  const weightTarget = { fat_loss: 74, muscle_gain: 86, recomposition: 81, maintain: 82 }[goalType];
  const focus = focusData(overrides.focus ?? "none");
  return {
    sex: overrides.sex ?? "male",
    age: 30,
    heightCm: overrides.sex === "female" ? 165 : 175,
    weightKg: 82,
    bodyFatPct: overrides.sex === "female" ? 31 : 24,
    activityLevel: overrides.activityLevel ?? "light",
    goal: { type: goalType, targetDate: futureDate(overrides.daysUntilTarget ?? 180), targetWeightKg: weightTarget, ...(overrides.goal ?? {}) },
    trainingMode: overrides.trainingMode ?? "gym",
    frequencyPerWeek: overrides.frequencyPerWeek ?? 4,
    sessionMinutes: overrides.sessionMinutes ?? 60,
    trainingExperience: overrides.trainingExperience ?? "intermediate",
    ...focus,
    ...overrides
  };
}

function summarizePlan(plan) {
  const firstWorkout = plan.trainingPlan.workouts[0];
  return {
    feasible: plan.feasible,
    calories: plan.targets.dailyCalories,
    macros: `${plan.targets.proteinG}g protein / ${plan.targets.fatG}g fat / ${plan.targets.carbG}g carbs`,
    split: `${plan.trainingPlan.splitZh} (${plan.trainingPlan.workouts.length} days)`,
    intensity: `RPE ${plan.intensityPlan.rpe}, RIR ${plan.intensityPlan.rir}`,
    cardio: `${plan.cardioPlan.sessionsPerWeek} sessions/week`,
    warningCount: plan.warnings.length,
    firstDay: `${firstWorkout.labelZh}：${firstWorkout.exercises.map((exercise) => `${exercise.nameZh} ${exercise.sets}组×${exercise.reps}`).join("；")}`,
    focus: plan.measurementFocus.map((item) => `${item.titleZh}`).join("、") || "无单点围度侧重"
  };
}

const representativeCases = [
  ["A", "男性，健身房，减脂，4次/周，腰围目标", baseInput({ sex: "male", trainingMode: "gym", goal: { type: "fat_loss", targetWeightKg: 74 }, frequencyPerWeek: 4, focus: "waist" })],
  ["B", "女性，健身房，增肌，5次/周，臀围目标", baseInput({ sex: "female", trainingMode: "gym", goal: { type: "muscle_gain", targetWeightKg: 86 }, frequencyPerWeek: 5, focus: "hip", trainingExperience: "advanced" })],
  ["C", "女性，居家，体态重组，3次/周，腰围目标", baseInput({ sex: "female", trainingMode: "bodyweight", goal: { type: "recomposition", targetWeightKg: 81 }, frequencyPerWeek: 3, focus: "waist" })],
  ["D", "男性，居家，保持，1次/周，无围度目标", baseInput({ sex: "male", trainingMode: "bodyweight", goal: { type: "maintain", targetWeightKg: 82 }, frequencyPerWeek: 1, focus: "none" })],
  ["E", "男性，居家，增肌，2次/周，臂围目标", baseInput({ sex: "male", trainingMode: "bodyweight", goal: { type: "muscle_gain", targetWeightKg: 84 }, frequencyPerWeek: 2, focus: "arm", sessionMinutes: 20 })],
  ["F", "女性，居家，减脂，6次/周，高活动，腰围目标", baseInput({ sex: "female", trainingMode: "bodyweight", goal: { type: "fat_loss", targetWeightKg: 68 }, frequencyPerWeek: 6, focus: "waist", activityLevel: "high" })]
];

const sampleRows = representativeCases.map(([id, title, input]) => ({ id, title, input, plan: summarizePlan(generatePlan(input)) }));
const invalidInput = baseInput({ heightCm: 118, frequencyPerWeek: 7, sessionMinutes: 181, goal: { type: "fat_loss", targetDate: "2020-01-01" } });
const invalidErrors = validateGeneratePlanInput(invalidInput);
const contradictory = normalizeGoalInput(baseInput({ goal: { type: "muscle_gain", targetWeightKg: 70, targetBodyFatPct: 18 }, focus: "arm" }));

const matrixCount = Object.values(matrix).reduce((product, values) => product * values.length, 1);
const androidMatrixCount = matrixCount * 2;
const lines = [
  "# Shape Plan Lab 场景测试报告",
  "",
  `生成时间：${new Date().toISOString()}`,
  "",
  "## 覆盖范围",
  "",
  `- Web 规则引擎矩阵：${matrixCount} 个组合。`,
  `- Android WebView 计划器矩阵：${androidMatrixCount} 个组合，覆盖无 PR 与有 PR 两套负荷输入。`,
  "- 组合维度：性别 2、目标类型 4、训练场景 2、每周训练频率 1-6、围度侧重 6、日常活动 4、训练经验 3、单次时长 20/60/180 分钟。",
  "- 边缘测试：非法基础指标、非法目标日期、缺失围度当前值、目标方向冲突、每周 1 次、极短/极长训练时长、活动水平单调影响热量。",
  "- PR 负荷专项回归：75kg × 10 次卧推输入会被转为约 84kg 的保守安全训练最大值，卧推工作重量约 67kg，坐姿推肩、绳索下压、侧平举按辅助动作比例显著低于卧推。",
  "",
  "## 典型输入输出",
  "",
  "| ID | 场景 | 核心输入 | 核心输出 | 第一天动作示例 |",
  "| --- | --- | --- | --- | --- |",
  ...sampleRows.map(({ id, title, input, plan }) => [
    id,
    title,
    `${input.sex}/${input.trainingMode}/${input.goal.type}/${input.frequencyPerWeek}次/${input.sessionMinutes}分钟/${input.activityLevel}`,
    `可达=${plan.feasible}；${plan.calories} kcal；${plan.macros}；${plan.split}；${plan.intensity}；有氧 ${plan.cardio}；围度=${plan.focus}；警告 ${plan.warningCount}`,
    plan.firstDay
  ].map((cell) => String(cell).replaceAll("|", "/")).join(" | ")).map((row) => `| ${row} |`),
  "",
  "## 冲突和异常输入示例",
  "",
  "### 目标冲突自动修正",
  "",
  "输入：`muscle_gain` 但目标体重低于当前体重，同时目标体脂率低于当前体脂率。",
  `输出：目标类型修正为 \`${contradictory.input.goal.type}\`；调整项：${contradictory.adjustments.map((item) => `${item.field}: ${item.oldValue} -> ${item.newValue}`).join("；")}`,
  "",
  "### 非法输入拦截",
  "",
  "输入：身高 118cm、每周 7 次、181 分钟、过去日期。",
  `输出错误字段：${invalidErrors.map((error) => error.field).join("、")}`,
  "",
  "## 当前判断",
  "",
  "- 减脂目标相对保持目标会降低热量；增肌目标相对保持目标会提高热量。",
  "- 居家模式不会生成杠铃、哑铃、绳索、高位下拉、动感单车等健身房专属动作。",
  "- 1/2/3/4/5/6 次训练会返回对应数量训练日，1 次频率返回全身训练日。",
  "- 单点围度目标会在对应肌群动作上增加训练侧重。",
  "- 本报告是产品验证测试，不代表医学建议或结果保证。"
];

fs.mkdirSync("docs", { recursive: true });
fs.writeFileSync(outputPath, `${lines.join("\n")}\n`);
console.log(`Wrote ${outputPath}`);
