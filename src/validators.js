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
  const hasWaistTarget = hasValue(goal.targetWaistCm);
  if (goal.type !== "maintain" && !hasWeightTarget && !hasBodyFatTarget && !hasWaistTarget) {
    addError(errors, "goal", "请至少填写目标体重、目标体脂率或目标腰围中的一项。");
  }

  if (goal.type === "fat_loss") {
    if (hasWeightTarget && goal.targetWeightKg >= input.weightKg) addError(errors, "targetWeightKg", "减脂目标的目标体重必须低于当前体重。");
    if (hasBodyFatTarget && hasValue(input.bodyFatPct) && goal.targetBodyFatPct >= input.bodyFatPct) addError(errors, "targetBodyFatPct", "减脂目标的目标体脂率必须低于当前体脂率。");
  }

  if (goal.type === "muscle_gain") {
    if (hasWeightTarget && goal.targetWeightKg <= input.weightKg) addError(errors, "targetWeightKg", "增肌目标的目标体重必须高于当前体重。");
    if (hasBodyFatTarget && hasValue(input.bodyFatPct) && goal.targetBodyFatPct < input.bodyFatPct) addError(errors, "targetBodyFatPct", "纯增肌目标不能同时要求体脂率下降；请改选体态重组或调整体脂目标。");
  }

  if (goal.type === "recomposition") {
    if (hasWeightTarget && Math.abs(goal.targetWeightKg - input.weightKg) > input.weightKg * 0.05) addError(errors, "targetWeightKg", "体态重组的目标体重建议控制在当前体重上下 5% 内；更大变化请选减脂或增肌。");
    if (hasBodyFatTarget && hasValue(input.bodyFatPct) && goal.targetBodyFatPct >= input.bodyFatPct) addError(errors, "targetBodyFatPct", "体态重组应以降低体脂率为目标，目标体脂率需低于当前值。");
  }

  if (goal.type === "maintain") {
    if (hasWeightTarget && Math.abs(goal.targetWeightKg - input.weightKg) > input.weightKg * 0.02) addError(errors, "targetWeightKg", "保持目标的体重变化不能超过当前体重的 2%；更大变化请切换目标类型。");
    if (hasBodyFatTarget && hasValue(input.bodyFatPct) && Math.abs(goal.targetBodyFatPct - input.bodyFatPct) > 2) addError(errors, "targetBodyFatPct", "保持目标的体脂变化不能超过 2 个百分点；更大变化请切换目标类型。");
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
