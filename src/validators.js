function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function addError(errors, field, message) {
  errors.push({ field, message });
}

function hasValue(value) {
  return value !== undefined && value !== null;
}

const circumferenceFields = ["waistCm", "chestCm", "hipCm", "armCm", "thighCm"];

function isIsoDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function validateGeneratePlanInput(input) {
  const errors = [];
  if (!isObject(input)) return [{ field: "body", message: "请求数据必须是对象。" }];

  if (!["male", "female"].includes(input.sex)) addError(errors, "sex", "请选择性别。");
  if (hasValue(input.age) && (!Number.isInteger(input.age) || input.age < 16 || input.age > 90)) addError(errors, "age", "年龄需在 16 到 90 岁之间。");
  if (!isFiniteNumber(input.heightCm) || input.heightCm < 120 || input.heightCm > 230) addError(errors, "heightCm", "身高需在 120 到 230 cm 之间。");
  if (!isFiniteNumber(input.weightKg) || input.weightKg < 30 || input.weightKg > 300) addError(errors, "weightKg", "体重需在 30 到 300 kg 之间。");
  if (hasValue(input.bodyFatPct) && (!isFiniteNumber(input.bodyFatPct) || input.bodyFatPct < 2 || input.bodyFatPct > 60)) addError(errors, "bodyFatPct", "体脂率需在 2% 到 60% 之间。");
  for (const field of circumferenceFields) {
    if (hasValue(input.currentCircumference?.[field]) && (!isFiniteNumber(input.currentCircumference[field]) || input.currentCircumference[field] < 15 || input.currentCircumference[field] > 200)) addError(errors, `currentCircumference.${field}`, "围度需在 15 到 200 cm 之间。");
    if (hasValue(input.goalCircumference?.[field]) && (!isFiniteNumber(input.goalCircumference[field]) || input.goalCircumference[field] < 15 || input.goalCircumference[field] > 200)) addError(errors, `goalCircumference.${field}`, "目标围度需在 15 到 200 cm 之间。");
  }
  if (!["bodyweight", "gym"].includes(input.trainingMode)) addError(errors, "trainingMode", "请选择训练场景。");
  if (hasValue(input.frequencyPerWeek) && (!Number.isInteger(input.frequencyPerWeek) || input.frequencyPerWeek < 1 || input.frequencyPerWeek > 6)) addError(errors, "frequencyPerWeek", "每周训练次数需在 1 到 6 次之间。");
  if (hasValue(input.sessionMinutes) && (!Number.isInteger(input.sessionMinutes) || input.sessionMinutes < 20 || input.sessionMinutes > 180)) addError(errors, "sessionMinutes", "每次训练时长需在 20 到 180 分钟之间。");

  if (!isObject(input.goal)) {
    addError(errors, "goal", "请设置目标类型和达成日期。");
    return errors;
  }

  const { goal } = input;
  if (!["fat_loss", "muscle_gain", "recomposition", "maintain"].includes(goal.type)) addError(errors, "goalType", "请选择有效的目标类型。");
  if (!isIsoDate(goal.targetDate)) {
    addError(errors, "targetDate", "请输入有效的达成日期。");
  } else if (goal.targetDate <= todayIsoDate()) {
    addError(errors, "targetDate", "达成日期必须晚于今天。");
  }
  if (hasValue(goal.targetWeightKg) && (!isFiniteNumber(goal.targetWeightKg) || goal.targetWeightKg < 30 || goal.targetWeightKg > 300)) addError(errors, "targetWeightKg", "目标体重需在 30 到 300 kg 之间。");
  if (hasValue(goal.targetBodyFatPct) && (!isFiniteNumber(goal.targetBodyFatPct) || goal.targetBodyFatPct < 2 || goal.targetBodyFatPct > 60)) addError(errors, "targetBodyFatPct", "目标体脂率需在 2% 到 60% 之间。");

  if (errors.length > 0) return errors;

  const hasWeightTarget = hasValue(goal.targetWeightKg);
  const hasBodyFatTarget = hasValue(goal.targetBodyFatPct);
  const hasCircumferenceTarget = circumferenceFields.some((field) => hasValue(input.goalCircumference?.[field]));
  if (goal.type !== "maintain" && !hasWeightTarget && !hasBodyFatTarget && !hasCircumferenceTarget) {
    addError(errors, "goal", "请至少填写目标体重、目标体脂率或目标围度中的一项。");
  }

  for (const field of circumferenceFields) {
    const current = input.currentCircumference?.[field];
    const target = input.goalCircumference?.[field];
    if (hasValue(target) && !hasValue(current)) addError(errors, `currentCircumference.${field}`, "填写目标围度时，也需要填写当前围度以便评估变化幅度。");
    if (!hasValue(current) || !hasValue(target)) continue;
  }

  return errors.length > 0 ? errors : null;
}

export function validateReviewPlanInput(input) {
  if (!isObject(input)) return [{ field: "body", message: "请求数据必须是对象。" }];
  const generateError = validateGeneratePlanInput(input.originalInput);
  if (generateError) return generateError.map((error) => ({ ...error, field: `originalInput.${error.field}` }));
  if (!isObject(input.currentPlan)) return [{ field: "currentPlan", message: "需要当前计划数据。" }];
  if (!Array.isArray(input.bodyMetricsHistory) || !Array.isArray(input.trainingHistory) || !Array.isArray(input.nutritionHistory)) {
    return [{ field: "history", message: "身体指标、训练和饮食历史记录必须为数组。" }];
  }
  return null;
}
