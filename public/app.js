const form = document.querySelector("#plan-form");
const results = document.querySelector("#result");
const errorBox = document.querySelector("#form-error");
const reviewSection = document.querySelector("#review-section");
const reviewButton = document.querySelector("#review-button");
const reviewResult = document.querySelector("#review-result");
const languageButton = document.querySelector("#language-toggle");
const exportControls = document.querySelector("#export-controls");
const exportButton = document.querySelector("#export-button");

let currentInput;
let currentPlan;
let language = "zh";

const copy = {
  zh: {
    generate: "生成科学计划", calculating: "正在计算…", planTitle: "一条可走通的路径", reviseTitle: "先收紧目标约束", statusGood: "目标可达成", statusCaution: "可执行，需注意", statusStop: "需要调整目标",
    calories: "每日 kcal", protein: "蛋白质", fat: "脂肪", carbs: "碳水", growth: "成长预测轨迹", growthCopy: "按当前饮食、活动与训练频率假设，展示预计体重趋势。", why: "为什么生成这份计划", rules: "规则解读", sessions: "次 / 周", days: "天 / 周", cardioReason: "有氧安排依据", reviewTitle: "根据真实数据复评", reviewCopy: "这部分模拟每周指标、训练频率和每日饮食记录。点击后，系统会重新计算并立即应用新计划。", reviewButton: "基于历史记录调整计划", reviewing: "正在复评…", export: "导出计划长图", updated: "已应用新计划", noChange: "当前参数无需修改", reviewFail: "复评失败", fieldNames: { dailyCalories: "每日热量", frequencyPerWeek: "每周训练次数", timeline: "目标日期", goalType: "目标类型" }, reviewLabels: { keep_plan: "保持当前计划", adjust_targets: "已调整摄入或训练目标", adjust_timeline: "已延长目标周期", adjust_goal: "已调整目标类型", stop_and_reassess: "暂停并重新评估" }
  },
  en: {
    generate: "Generate plan", calculating: "Calculating…", planTitle: "A path you can follow", reviseTitle: "Tighten the constraints first", statusGood: "Target feasible", statusCaution: "Feasible with notes", statusStop: "Target needs revision",
    calories: "Daily kcal", protein: "Protein", fat: "Fat", carbs: "Carbs", growth: "Growth projection", growthCopy: "Estimated body-weight trend based on current nutrition, activity, and training assumptions.", why: "Why this plan", rules: "Rule explanation", sessions: "sessions / week", days: "days / week", cardioReason: "Cardio rationale", reviewTitle: "Review with real data", reviewCopy: "Use weekly metrics, completed sessions, and nutrition records. A review recalculates and immediately applies the new plan.", reviewButton: "Adjust plan from history", reviewing: "Reviewing…", export: "Export plan image", updated: "Updated plan applied", noChange: "No parameter change required", reviewFail: "Review failed", fieldNames: { dailyCalories: "Daily calories", frequencyPerWeek: "Weekly sessions", timeline: "Target date", goalType: "Goal type" }, reviewLabels: { keep_plan: "Keep current plan", adjust_targets: "Nutrition or training targets updated", adjust_timeline: "Target timeline extended", adjust_goal: "Goal type updated", stop_and_reassess: "Stop and reassess" }
  }
};

function text() { return copy[language]; }
function numberOrUndefined(value) { return value === "" ? undefined : Number(value); }
function localized(primary, fallback) { return language === "zh" ? primary : fallback || primary; }
function localizedSummary(payload) { return language === "zh" ? (payload.summaryZh || payload.summary) : payload.summary; }
function formatGoal(goalType) { return language === "zh" ? { fat_loss: "减脂", muscle_gain: "增肌", recomposition: "体态重组", maintain: "保持" }[goalType] : { fat_loss: "FAT LOSS", muscle_gain: "MUSCLE GAIN", recomposition: "RECOMPOSITION", maintain: "MAINTENANCE" }[goalType]; }
function exerciseDescription(exercise) {
  const english = {
    push_up: "Keep your trunk rigid and lower under control.", bench_press: "Keep shoulder blades set and press with controlled range.",
    inverted_row: "Keep the body aligned and pull the chest toward the bar.", lat_pulldown: "Pull toward the upper chest without using momentum.",
    pike_push_up: "Keep the neck neutral and press through the shoulders.", db_press: "Press overhead with a neutral spine and controlled lowering.",
    barbell_row: "Hinge at the hips and pull the bar toward the lower ribs.", goblet_squat: "Hold the dumbbell close, stay upright, and descend under control.",
    band_curl: "Keep the upper arm still and avoid swinging.", db_curl: "Keep elbows near the body and lower slowly.",
    close_push_up: "Keep elbows tracking back and control the full range.", rope_pushdown: "Keep upper arms fixed and finish with a controlled lockout.",
    bodyweight_squat: "Track knees over toes and stand with even foot pressure.", barbell_squat: "Brace the trunk and keep the spine neutral throughout.",
    single_leg_rdl: "Hinge at the hips and control the movement on the standing leg.", rdl: "Hinge at the hips and keep the load close to the legs.",
    glute_bridge: "Drive through the heels and squeeze the glutes at the top.", hip_thrust: "Finish with the torso parallel to the floor without arching the low back.",
    calf_raise: "Use a controlled ankle range and pause at the top.", plank: "Keep shoulders, hips, and ankles aligned without letting the low back sag.",
    dead_bug: "Keep the low back in contact with the floor while moving slowly."
  };
  return language === "zh" ? exercise.descriptionZh : (english[exercise.id] || "Use a controlled range of motion and stop if pain occurs.");
}
function cardioDescription(exercise) {
  const english = { brisk_walk: "Use a pace where you can speak in full sentences but feel mildly breathless.", incline_walk: "Choose a sustainable incline and speed that keeps breathing controlled.", walk_jog_intervals: "Alternate brisk walking and easy jogging; recover fully before increasing pace.", bike_intervals: "Alternate brief harder efforts with easy pedaling to limit joint impact." };
  return language === "zh" ? exercise.descriptionZh : english[exercise.id];
}
function localizedNotice(note) {
  const translations = {
    "Required fat-loss rate exceeds 1.0 kg/week. Extend timeline or reduce target.": "所需减重速度超过每周 1.0 kg；请延长周期或降低目标。",
    "Muscle-gain mode with fewer than 3 sessions/week is unlikely to deliver visible progress.": "增肌模式每周少于 3 次训练，通常难以获得明显进展。",
    "Requested muscle-gain rate is aggressive. Expect higher fat-gain risk.": "目标增肌速度偏激进，脂肪增加风险更高。",
    "Target body-fat level is very lean for a general-fitness plan.": "目标体脂率对一般健身计划而言偏低。",
    "Short sessions reduce weekly training volume.": "单次训练时间较短，会降低每周可完成的训练量。",
    "Bodyweight-only muscle gain usually progresses more slowly.": "仅使用自重训练时，增肌进展通常较慢。",
    "Rule-based secondary review found no material conflicts.": "基于规则的二次校验未发现明显冲突。"
  };
  return language === "zh" ? (translations[note] || note) : note;
}
function localizedCalculationValue(item) {
  if (language === "en") return item.value;
  return item.value
    .replace("kcal/day", "千卡/天")
    .replace("Protein", "蛋白质")
    .replace("Fat", "脂肪")
    .replace("Carbohydrate", "碳水化合物")
    .replaceAll("|", "｜");
}
function resultLabels() {
  return language === "zh"
    ? { kicker: "你的", logic: "计划生成逻辑", logicHint: "计算过程、训练决策与可达性路径", science: "科学依据", scienceHint: "能量、营养、训练适应与安全边界", whyHint: "规则解读、执行策略与复评条件" }
    : { kicker: "YOUR", logic: "Plan generation logic", logicHint: "Calculations, training decisions, and feasibility path", science: "Scientific basis", scienceHint: "Energy, nutrition, training adaptation, and safety limits", whyHint: "Rules, execution strategy, and review criteria" };
}

function statusMeta(plan) {
  if (!plan.feasible) return { className: "stop", label: text().statusStop };
  if (plan.warnings.length) return { className: "caution", label: text().statusCaution };
  return { className: "good", label: text().statusGood };
}

function clearValidationErrors() {
  errorBox.innerHTML = "";
  form.querySelectorAll(".invalid").forEach((field) => field.classList.remove("invalid"));
  form.querySelectorAll(".auto-adjusted").forEach((field) => field.classList.remove("auto-adjusted"));
}

const formNameByAdjustmentField = {
  "goal.type": "goalType",
  "goal.targetWeightKg": "targetWeightKg",
  "goal.targetBodyFatPct": "targetBodyFatPct",
  "goalCircumference.waistCm": "goalWaistCm",
  "goalCircumference.chestCm": "goalChestCm",
  "goalCircumference.hipCm": "goalHipCm",
  "goalCircumference.armCm": "goalArmCm",
  "goalCircumference.thighCm": "goalThighCm"
};

function applyGoalAdjustments(adjustments) {
  adjustments.forEach((adjustment) => {
    const field = form.elements.namedItem(formNameByAdjustmentField[adjustment.field]);
    if (!field) return;
    field.value = adjustment.newValue;
    field.classList.add("auto-adjusted");
    field.setAttribute("aria-describedby", "goal-adjustment-summary");
  });
}

function adjustmentMarkup(adjustments) {
  if (!adjustments?.length) return "";
  const heading = language === "zh" ? "系统已修正目标参数" : "Goals adjusted for feasibility";
  const description = language === "zh"
    ? "以下红色输入框已按安全性、目标类型和截止日期约束自动调整。计划依据调整后的数值生成。"
    : "The red inputs were updated for safety, goal compatibility, and the selected deadline. The plan uses the adjusted values.";
  return `<section id="goal-adjustment-summary" class="goal-adjustments"><p class="kicker">AUTO-CORRECTED TARGETS</p><h3>${heading}</h3><p>${description}</p>${adjustments.map((adjustment) => `<article><strong>${adjustment.oldValue} → ${adjustment.newValue}</strong><span>${localized(adjustment.reasonZh, adjustment.reason)}</span></article>`).join("")}</section>`;
}

function renderValidationErrors(errors) {
  errorBox.innerHTML = `<ul>${errors.map((error) => `<li>${localizedServerError(error.message || error)}</li>`).join("")}</ul>`;
  errors.forEach((error) => {
    const field = form.elements.namedItem(error.field);
    if (field && "classList" in field) field.classList.add("invalid");
  });
}

function localizedServerError(message) {
  if (language === "zh" || typeof message !== "string") return message;
  const translations = { "请求数据必须是对象。": "Request data must be an object.", "请选择性别。": "Select a sex.", "身高需在 120 到 230 cm 之间。": "Height must be between 120 and 230 cm.", "体重需在 30 到 300 kg 之间。": "Weight must be between 30 and 300 kg.", "达成日期必须晚于今天。": "Target date must be after today.", "请至少填写目标体重、目标体脂率或目标围度中的一项。": "Enter at least one target: weight, body fat, or circumference.", "填写目标围度时，也需要填写当前围度以便评估变化幅度。": "Enter the current circumference to evaluate a circumference target." };
  return translations[message] || "Please correct the highlighted input.";
}

function validateClientInput(input) {
  const errors = [];
  const add = (field, message) => errors.push({ field, message });
  const goal = input.goal;
  const hasWeight = goal.targetWeightKg !== undefined;
  const hasBodyFat = goal.targetBodyFatPct !== undefined;
  if (goal.targetDate <= new Date().toISOString().slice(0, 10)) add("targetDate", language === "zh" ? "达成日期必须晚于今天。" : "Target date must be after today.");
  const hasCircumferenceTarget = Object.values(input.goalCircumference || {}).some((value) => value !== undefined);
  if (goal.type !== "maintain" && !hasWeight && !hasBodyFat && !hasCircumferenceTarget) add("goal", language === "zh" ? "请至少填写目标体重、目标体脂率或目标围度。" : "Enter at least one target: weight, body fat, or circumference.");
  return errors;
}

function growthChart(points) {
  const width = 620;
  const height = 170;
  const pad = { top: 12, right: 10, bottom: 24, left: 37 };
  const weights = points.map((point) => point.weightKg);
  const minimum = Math.floor(Math.min(...weights) - .5);
  const maximum = Math.ceil(Math.max(...weights) + .5);
  const x = (index) => pad.left + index * ((width - pad.left - pad.right) / Math.max(1, points.length - 1));
  const y = (weight) => pad.top + (maximum - weight) * ((height - pad.top - pad.bottom) / Math.max(.1, maximum - minimum));
  const line = points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(point.weightKg).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1)},${height - pad.bottom} L${x(0)},${height - pad.bottom} Z`;
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${text().growth}"><line class="axis" x1="${pad.left}" y1="${height - pad.bottom}" x2="${width - pad.right}" y2="${height - pad.bottom}" /><text x="0" y="${pad.top + 4}">${maximum}kg</text><text x="0" y="${height - pad.bottom}">${minimum}kg</text><path class="area" d="${area}" /><path class="line" d="${line}" />${points.map((point, index) => `<circle class="dot" cx="${x(index)}" cy="${y(point.weightKg)}" r="${index === points.length - 1 ? 4 : 2.2}" />`).join("")}</svg>`;
}

function renderPlan(plan) {
  const status = statusMeta(plan);
  const workoutMarkup = plan.trainingPlan.workouts.map((workout, index) => `<details class="workout" ${index === 0 ? "open" : ""}><summary><span>${localized(`${workout.labelZh} · ${workout.focusZh}`, `${workout.label} · ${workout.focus}`)}</span><small>${workout.exercises.length} ${language === "zh" ? "个动作" : "moves"} +</small></summary><ul class="exercise-list">${workout.exercises.map((exercise) => `<li><strong>${localized(exercise.nameZh, exercise.name)}${exercise.emphasis ? `<em>${language === "zh" ? "目标部位加组" : "Target volume +1"}</em>` : ""}<small>${language === "zh" ? "" : exercise.nameZh}</small></strong><span>${exercise.sets} ${language === "zh" ? "组" : "sets"} × ${exercise.reps}<small>${localized(exercise.muscleGroupZh, exercise.muscleGroup)} · ${language === "zh" ? `用力等级 ${exercise.intensity.rpe}，余力 ${exercise.intensity.rir} 次` : `RPE ${exercise.intensity.rpe} / RIR ${exercise.intensity.rir}`}</small></span><span>${language === "zh" ? "休息" : "Rest"} ${exercise.restSeconds}${language === "zh" ? "秒" : "s"}<small>${language === "zh" ? exercise.intensity.loadGuidanceZh : exercise.intensity.loadGuidance}</small></span><p class="exercise-tip">${exerciseDescription(exercise)}</p></li>`).join("")}</ul></details>`).join("");
  const cardioMarkup = plan.cardioPlan.exercises.map((exercise) => `<div class="cardio-item"><div><strong>${localized(exercise.nameZh, exercise.name)}<small>${language === "zh" ? exercise.name : exercise.nameZh}</small></strong><p>${cardioDescription(exercise)}</p></div><span>${exercise.durationMinutes} ${language === "zh" ? "分钟" : "min"}<br /><small>${language === "zh" ? exercise.intensity : ({ "低到中等": "Low to moderate", "中等到较高": "Moderate to high" }[exercise.intensity] || exercise.intensity)}</small></span></div>`).join("");
  const rationaleMarkup = plan.rationale.map((item) => `<article class="rationale-item"><h4>${localized(item.titleZh, item.title)}</h4><p>${localized(item.textZh, item.text)}</p></article>`).join("");
  const logic = plan.planningLogic;
  const calculationsMarkup = logic.calculations.map((item) => `<article class="rationale-item"><h4>${language === "zh" ? item.labelZh : item.label}：${localizedCalculationValue(item)}</h4><p>${language === "zh" ? item.explanationZh : item.explanation}</p></article>`).join("");
  const evidenceMarkup = logic.evidenceBasis.map((item) => `<article class="rationale-item"><h4>${localized(item.titleZh, item.title)}</h4><p>${localized(item.textZh, item.text)}</p></article>`).join("");
  const logicMarkup = `<article class="rationale-item"><h4>${localized(logic.inputAssessment.titleZh, logic.inputAssessment.title)}</h4><p>${localized(logic.inputAssessment.textZh, logic.inputAssessment.text)}</p></article>${calculationsMarkup}<article class="rationale-item"><h4>${localized(logic.trainingDecision.titleZh, logic.trainingDecision.title)}</h4><p>${localized(logic.trainingDecision.textZh, logic.trainingDecision.text)}</p></article><article class="rationale-item"><h4>${localized(logic.intensityDecision.titleZh, logic.intensityDecision.title)}</h4><p>${localized(logic.intensityDecision.textZh, logic.intensityDecision.text)}</p></article><article class="rationale-item feasibility-path"><h4>${localized(logic.feasibilityPath.titleZh, logic.feasibilityPath.title)}</h4><p>${localized(logic.feasibilityPath.textZh, logic.feasibilityPath.text)}</p></article>`;
  const intensity = plan.intensityPlan;
  const intensityMarkup = `<details class="intensity-card"><summary><span><b>${language === "zh" ? "训练强度处方" : "Intensity prescription"}</b><small>${language === "zh" ? `工作组：用力等级 ${intensity.rpe}，余力 ${intensity.rir} 次` : `Working sets: RPE ${intensity.rpe} · RIR ${intensity.rir}`}</small></span><i>+</i></summary><div><p>${localized(intensity.intensityReasonZh, intensity.intensityReason)}</p><div class="volume-pills">${intensity.targetVolumes.map((item) => `<span>${language === "zh" ? item.groupZh : item.groupLabel} ${item.sets} ${language === "zh" ? "有效组/周" : "hard sets/wk"}</span>`).join("") || `<span>${language === "zh" ? "全身均衡有效组" : "Balanced full-body hard sets"}</span>`}</div><p><strong>${language === "zh" ? "进阶条件：" : "Progression: "}</strong>${localized(intensity.progressionZh, intensity.progression)}</p></div></details>`;
  const notices = [...plan.warnings, ...plan.llmReview.notes].map((note, index) => `<div class="notice ${index === plan.warnings.length ? "safe" : ""}">${localizedNotice(note)}</div>`).join("");
  const splitTitle = localized(plan.trainingPlan.splitZh, plan.trainingPlan.split.replaceAll("_", " "));
  const labels = resultLabels();

  results.innerHTML = `${adjustmentMarkup(plan.goalAdjustments)}<div class="result-top"><div><p class="kicker">${labels.kicker} ${formatGoal(currentInput.goal.type)} ${language === "zh" ? "计划" : "PLAN"}</p><h2>${plan.feasible ? text().planTitle : text().reviseTitle}</h2><p class="result-summary">${localizedSummary(plan)}</p></div><span class="status ${status.className}">${status.label}</span></div><div class="targets"><div class="metric"><b>${plan.targets.dailyCalories}</b><span>${text().calories}</span></div><div class="metric"><b>${plan.targets.proteinG}${language === "zh" ? "克" : "g"}</b><span>${text().protein}</span></div><div class="metric"><b>${plan.targets.fatG}${language === "zh" ? "克" : "g"}</b><span>${text().fat}</span></div><div class="metric"><b>${plan.targets.carbG}${language === "zh" ? "克" : "g"}</b><span>${text().carbs}</span></div></div><div class="chart-card"><h3>${text().growth}</h3><p>${text().growthCopy}</p>${growthChart(plan.growthProjection.weekly)}</div>${intensityMarkup}<div class="rationale"><details class="explanation-panel"><summary><span><b>${labels.logic}</b><small>${labels.logicHint}</small></span><i>+</i></summary><div class="explanation-content">${logicMarkup}</div></details><details class="explanation-panel"><summary><span><b>${labels.science}</b><small>${labels.scienceHint}</small></span><i>+</i></summary><div class="explanation-content">${evidenceMarkup}</div></details><details class="explanation-panel"><summary><span><b>${text().why}</b><small>${labels.whyHint}</small></span><i>+</i></summary><div class="explanation-content">${rationaleMarkup}</div></details></div><div class="workout-heading"><h3>${splitTitle}</h3><span>${plan.trainingPlan.days} ${text().days}</span></div><div class="workouts">${workoutMarkup}</div><div class="cardio-card"><div class="workout-heading"><h3>${localized(plan.cardioPlan.titleZh, plan.cardioPlan.title)}</h3><span>${plan.cardioPlan.sessionsPerWeek} ${text().sessions}</span></div><p>${localized(plan.cardioPlan.reasonZh, plan.cardioPlan.reason)}</p>${cardioMarkup}</div><div class="notices">${notices}</div>`;
}

function createInput(formData) {
  const currentCircumference = { waistCm: numberOrUndefined(formData.get("currentWaistCm")), chestCm: numberOrUndefined(formData.get("currentChestCm")), hipCm: numberOrUndefined(formData.get("currentHipCm")), armCm: numberOrUndefined(formData.get("currentArmCm")), thighCm: numberOrUndefined(formData.get("currentThighCm")) };
  const goalCircumference = { waistCm: numberOrUndefined(formData.get("goalWaistCm")), chestCm: numberOrUndefined(formData.get("goalChestCm")), hipCm: numberOrUndefined(formData.get("goalHipCm")), armCm: numberOrUndefined(formData.get("goalArmCm")), thighCm: numberOrUndefined(formData.get("goalThighCm")) };
  return { sex: formData.get("sex"), age: numberOrUndefined(formData.get("age")), heightCm: Number(formData.get("heightCm")), weightKg: Number(formData.get("weightKg")), bodyFatPct: numberOrUndefined(formData.get("bodyFatPct")), goal: { type: formData.get("goalType"), targetDate: formData.get("targetDate"), targetWeightKg: numberOrUndefined(formData.get("targetWeightKg")), targetBodyFatPct: numberOrUndefined(formData.get("targetBodyFatPct")) }, currentCircumference, goalCircumference, trainingMode: formData.get("trainingMode"), frequencyPerWeek: Number(formData.get("frequencyPerWeek")), sessionMinutes: numberOrUndefined(formData.get("sessionMinutes")), activityLevel: formData.get("activityLevel"), trainingExperience: formData.get("trainingExperience") };
}

function translateStaticUi() {
  const english = language === "en";
  document.documentElement.lang = english ? "en" : "zh-CN";
  document.title = english ? "Shape Plan Lab | Fitness Plan Validator" : "塑形计划实验室｜健身计划验证台";
  languageButton.textContent = english ? "Switch language" : "切换语言";
  document.querySelector("#brand-name").textContent = english ? "Shape Plan Lab" : "塑形计划实验室";
  document.querySelector("#brand-mark").textContent = english ? "SP" : "塑";
  document.querySelector("#brand-link").setAttribute("aria-label", english ? "Shape Plan Lab home" : "塑形计划实验室首页");
  form.querySelector("button span").textContent = text().generate;
  document.querySelector("#export-button").childNodes[0].textContent = `${text().export} `;
  reviewButton.childNodes[0].textContent = `${text().reviewButton} `;
  const labels = { sex: ["性别 *", "Sex *"], age: ["年龄", "Age"], heightCm: ["身高 (cm) *", "Height (cm) *"], weightKg: ["体重 (kg) *", "Weight (kg) *"], bodyFatPct: ["体脂率 (%)", "Body fat (%)"], activityLevel: ["日常活动", "Daily activity"], goalType: ["目标类型 *", "Goal type *"], targetDate: ["达成日期 *", "Target date *"], targetWeightKg: ["目标体重 (kg)", "Target weight (kg)"], targetBodyFatPct: ["目标体脂率 (%)", "Target body fat (%)"], trainingMode: ["训练场景 *", "Training setting *"], frequencyPerWeek: ["每周训练次数 *", "Sessions per week *"], sessionMinutes: ["每次训练时长 (分钟)", "Session duration (min)"], trainingExperience: ["训练经验", "Training experience"] };
  Object.entries(labels).forEach(([name, values]) => { const field = form.elements.namedItem(name); const label = field?.closest("label"); if (label?.firstChild) label.firstChild.textContent = values[english ? 1 : 0]; });
  document.querySelectorAll("fieldset legend")[0].textContent = english ? "Baseline metrics" : "基础指标";
  document.querySelectorAll("fieldset legend")[1].textContent = english ? "Goal and constraints" : "目标与约束";
  document.querySelector("#circumference-legend").textContent = english ? "Optional circumference targets (cm)" : "可选围度目标（厘米）";
  document.querySelector("#circumference-hint").textContent = english ? "Only enter areas you want to change. Current and target values must be entered as a pair. The waist target must be smaller; chest, hip, arm, and thigh targets must be larger." : "仅填写需要改善的部位：当前值与目标值需成对填写。腰围仅支持缩小；胸、臀、臂、大腿围仅支持增大。";
  ["measurement-part", "measurement-current", "measurement-target"].forEach((id, index) => { document.querySelector(`#${id}`).textContent = (english ? ["Area", "Current", "Target"] : ["部位", "当前值", "目标值"])[index]; });
  const measurements = [["waist", "腰围", "Waist"], ["chest", "胸围", "Chest"], ["hip", "臀围", "Hip"], ["arm", "臂围", "Arm"], ["thigh", "大腿围", "Thigh"]];
  measurements.forEach(([key, zh, en]) => {
    document.querySelector(`#measurement-label-${key}`).textContent = english ? en : zh;
    const current = form.elements.namedItem(`current${key[0].toUpperCase()}${key.slice(1)}Cm`);
    const target = form.elements.namedItem(`goal${key[0].toUpperCase()}${key.slice(1)}Cm`);
    current.setAttribute("aria-label", english ? `Current ${en.toLowerCase()} circumference` : `当前${zh}`);
    target.setAttribute("aria-label", english ? `Target ${en.toLowerCase()} circumference` : `目标${zh}`);
    current.placeholder = english ? "e.g. 91" : "例如 91";
    target.placeholder = english ? "e.g. 86" : "例如 86";
  });
  document.querySelector(".review-header h2").textContent = text().reviewTitle;
  document.querySelector(".review-header p:last-child").textContent = text().reviewCopy;
  const staticText = english ? {
    "hero-eyebrow": "MVP 1.0 · WEB VALIDATION", "profile-kicker": "01 / PROFILE", "review-kicker": "02 / PLAN REVIEW", "empty-index": "READY", "hero-title": "Turn a target into<br /><em>a path you can execute.</em>", "hero-copy": "Enter body metrics, goals, and the time you can train. The rule engine checks safety and feasibility before producing training, nutrition, and growth projections.", "pill-one": "Rule engine", "pill-two": "Secondary review", "pill-three": "History review", "profile-title": "Build your plan", "profile-copy": "Fields marked <strong>*</strong> are used for calculation. Optional data improves projection reliability.", "empty-title": "Ready for input", "empty-copy": "Enter your data to generate calories, macros, training structure, and a target trajectory.", "label-weight-start": "Week 1 weight (kg)", "label-weight-current": "Current weight (kg)", "label-body-fat-current": "Current body fat (%)", "label-completed-frequency": "Actual weekly sessions", "label-average-calories": "Recent average calories (kcal)", "label-average-protein": "Recent protein (g)", "footer-copy": "A rule-engine product validation demo, not medical advice. Consult a qualified medical professional for medical conditions, pregnancy, minors, or eating-disorder risk." } : {
    "hero-eyebrow": "1.0 版 · 网页验证", "profile-kicker": "01 / 个人资料", "review-kicker": "02 / 计划复评", "empty-index": "准备就绪", "hero-title": "把目标变成<br /><em>可执行的路径。</em>", "hero-copy": "输入身体指标、目标和可投入的训练时间。规则引擎先校验安全与可达成性，再输出训练、营养和成长预测。", "pill-one": "规则引擎", "pill-two": "二次校验", "pill-three": "历史复评", "profile-title": "创建你的计划", "profile-copy": "带 <strong>*</strong> 的字段用于计算。可选数据会提高预测可靠度。", "empty-title": "等待输入", "empty-copy": "填写左侧数据后，系统会生成热量、宏量、训练结构和目标轨迹。", "label-weight-start": "第 1 周体重（千克）", "label-weight-current": "当前体重（千克）", "label-body-fat-current": "当前体脂率（百分比）", "label-completed-frequency": "实际每周训练次数", "label-average-calories": "近期平均热量（千卡）", "label-average-protein": "近期蛋白质（克）", "footer-copy": "用于产品验证的规则引擎演示，不构成医疗建议。存在疾病、妊娠、未成年或饮食失调风险时，应先咨询医疗专业人士。" };
  Object.entries(staticText).forEach(([id, value]) => { const element = document.querySelector(`#${id}`); if (element && !id.startsWith("label-")) element.innerHTML = value; });
  const options = {
    sex: [["male", "男性", "Male"], ["female", "女性", "Female"]],
    activityLevel: [["sedentary", "久坐", "Sedentary"], ["light", "轻活动", "Light"], ["moderate", "中等活动", "Moderate"], ["high", "高活动", "High"]],
    goalType: [["fat_loss", "减脂 / 减重", "Fat loss"], ["muscle_gain", "增肌", "Muscle gain"], ["recomposition", "体态重组", "Recomposition"], ["maintain", "保持", "Maintenance"]],
    trainingMode: [["gym", "健身房", "Gym"], ["bodyweight", "自重 / 居家", "Bodyweight / home"]],
    trainingExperience: [["novice", "新手", "Novice"], ["intermediate", "中级", "Intermediate"], ["advanced", "高级", "Advanced"]]
  };
  Object.entries(options).forEach(([name, entries]) => entries.forEach(([value, zh, en]) => { const option = form.elements.namedItem(name)?.querySelector(`option[value="${value}"]`); if (option) option.textContent = english ? en : zh; }));
  ["label-weight-start", "label-weight-current", "label-body-fat-current", "label-completed-frequency", "label-average-calories", "label-average-protein"].forEach((id) => { const label = document.querySelector(`#${id}`); if (label?.firstChild) label.firstChild.textContent = staticText[id]; });
  if (currentPlan) renderPlan(currentPlan);
}

function downloadPlanImage() {
  if (!currentPlan) return;
  const items = [
    `${formatGoal(currentInput.goal.type)} PLAN`,
    `${text().calories}: ${currentPlan.targets.dailyCalories} kcal`,
    `${text().protein}: ${currentPlan.targets.proteinG}g · ${text().fat}: ${currentPlan.targets.fatG}g · ${text().carbs}: ${currentPlan.targets.carbG}g`,
    ...currentPlan.rationale.map((item) => `${localized(item.titleZh, item.title)}: ${localized(item.textZh, item.text)}`),
    ...currentPlan.trainingPlan.workouts.flatMap((workout) => [localized(`${workout.labelZh} · ${workout.focusZh}`, `${workout.label} · ${workout.focus}`), ...workout.exercises.map((exercise) => `  ${localized(exercise.nameZh, exercise.name)} · ${exercise.sets}×${exercise.reps}`)]),
    `${localized(currentPlan.cardioPlan.titleZh, currentPlan.cardioPlan.title)}: ${currentPlan.cardioPlan.exercises.map((exercise) => `${localized(exercise.nameZh, exercise.name)} ${exercise.durationMinutes}${language === "zh" ? "分钟" : "min"}`).join(" / ")}`
  ];
  const wrap = (value, maxLength) => value.match(new RegExp(`.{1,${maxLength}}`, "g")) || [value];
  const wrappedItems = items.flatMap((item) => wrap(item, language === "zh" ? 44 : 86));
  const lineHeight = 27;
  const width = 1080;
  const height = Math.max(700, 130 + wrappedItems.length * lineHeight);
  const escape = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const textRows = wrappedItems.map((item, index) => `<text x="64" y="${112 + index * lineHeight}" font-size="${index === 0 ? 34 : 18}" font-weight="${index === 0 ? 700 : 400}" fill="${index === 0 ? "#14261f" : "#314c3b"}">${escape(item)}</text>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#f4f1e8"/><rect x="34" y="32" width="${width - 68}" height="${height - 64}" rx="8" fill="#fbfaf5" stroke="#d8ddd4"/>${textRows}<text x="64" y="${height - 50}" font-size="14" fill="#637269">Shape Plan Lab · generated ${new Date().toLocaleDateString()}</text></svg>`;
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  anchor.download = `shape-plan-${currentInput.goal.type}.svg`;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearValidationErrors();
  const button = form.querySelector("button");
  button.disabled = true;
  button.querySelector("span").textContent = text().calculating;
  currentInput = createInput(new FormData(form));
  const clientErrors = validateClientInput(currentInput);
  if (clientErrors.length) { renderValidationErrors(clientErrors); button.disabled = false; button.querySelector("span").textContent = text().generate; return; }
  try {
    const response = await fetch("/api/plan/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(currentInput) });
    const data = await response.json();
    if (!response.ok) { if (data.errors) renderValidationErrors(data.errors); throw new Error(data.error || "计划生成失败。"); }
    currentInput = data.effectiveInput || currentInput;
    currentPlan = data;
    applyGoalAdjustments(data.goalAdjustments || []);
    renderPlan(data);
    exportControls.hidden = false;
    reviewSection.hidden = false;
    document.querySelector("#weight-start").value = currentInput.weightKg;
    document.querySelector("#weight-current").value = (currentInput.weightKg - .3).toFixed(1);
    document.querySelector("#body-fat-current").value = currentInput.bodyFatPct ? Math.max(1, currentInput.bodyFatPct - .2).toFixed(1) : "";
    document.querySelector("#average-calories").value = currentPlan.targets.dailyCalories;
    document.querySelector("#average-protein").value = currentPlan.targets.proteinG;
    reviewSection.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) { if (!errorBox.innerHTML) errorBox.textContent = error.message; } finally { button.disabled = false; button.querySelector("span").textContent = text().generate; }
});

reviewButton.addEventListener("click", async () => {
  if (!currentPlan || !currentInput) return;
  reviewButton.disabled = true;
  reviewButton.childNodes[0].textContent = `${text().reviewing} `;
  const currentWeight = Number(document.querySelector("#weight-current").value);
  const currentBodyFat = numberOrUndefined(document.querySelector("#body-fat-current").value);
  const completedFrequency = Number(document.querySelector("#completed-frequency").value);
  const calories = Number(document.querySelector("#average-calories").value);
  const protein = Number(document.querySelector("#average-protein").value);
  const startWeight = Number(document.querySelector("#weight-start").value);
  const today = new Date().toISOString().slice(0, 10);
  const payload = { originalInput: currentInput, currentPlan, reviewDate: today, bodyMetricsHistory: [{ date: "2026-08-01", weightKg: startWeight, bodyFatPct: currentInput.bodyFatPct }, { date: "2026-08-08", weightKg: (startWeight + currentWeight) / 2, bodyFatPct: currentBodyFat }, { date: today, weightKg: currentWeight, bodyFatPct: currentBodyFat }], trainingHistory: [{ weekStartDate: "2026-08-03", plannedFrequency: currentInput.frequencyPerWeek, completedFrequency }, { weekStartDate: "2026-08-10", plannedFrequency: currentInput.frequencyPerWeek, completedFrequency }], nutritionHistory: [{ date: "2026-08-13", calories, proteinGrams: protein, fatGrams: currentPlan.targets.fatG, carbGrams: currentPlan.targets.carbG }, { date: "2026-08-14", calories, proteinGrams: protein, fatGrams: currentPlan.targets.fatG, carbGrams: currentPlan.targets.carbG }] };
  try {
    const response = await fetch("/api/plan/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "计划复评失败。");
    currentInput = data.updatedInput;
    currentPlan = data.updatedPlan;
    renderPlan(currentPlan);
    const displayValue = (key, value) => key === "goalType" && language === "zh" ? ({ fat_loss: "减脂", muscle_gain: "增肌", recomposition: "体态重组", maintain: "保持" }[value] || value) : value;
    const adjustmentText = Object.entries(data.adjustments).map(([key, value]) => `<span>${text().fieldNames[key] || key}: ${displayValue(key, value.old)} → ${displayValue(key, value.new)}</span>`).join("");
    reviewResult.hidden = false;
    reviewResult.innerHTML = `<h3>${text().reviewLabels[data.reviewResult]}</h3><p>${localizedSummary(data)}</p><div class="adjustments">${adjustmentText || `<span>${text().noChange}</span>`}</div><p><strong>${text().updated}</strong></p>`;
  } catch (error) { reviewResult.hidden = false; reviewResult.innerHTML = `<h3>${text().reviewFail}</h3><p>${error.message}</p>`; } finally { reviewButton.disabled = false; reviewButton.childNodes[0].textContent = `${text().reviewButton} `; }
});

languageButton.addEventListener("click", () => { language = language === "zh" ? "en" : "zh"; translateStaticUi(); });
exportButton.addEventListener("click", downloadPlanImage);
translateStaticUi();
