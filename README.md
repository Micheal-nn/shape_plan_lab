# Shape Plan Lab / 塑形计划实验室

面向 Android 优先产品验证的健身计划 MVP。浏览器端与零依赖 Node.js API 使用同一套校验和规则引擎，确保输入约束、计划生成、历史复评一致。

## 中文说明

### 已实现能力

- 支持减脂、增肌、体态重组、保持四类目标。
- 校验基础数据、目标方向、期限、训练频率、单次训练时长与围度目标的合理性。
- 可选输入 **当前值 + 目标值**：腰围、胸围、臀围、臂围、大腿围（单位：cm）。
- 只有成对输入的围度数据才会参与计划：
  - 腰围目标必须小于当前值，系统通过总体能量缺口、力量训练与有氧协同支持腰围改善，**不会承诺局部减脂**。
  - 胸、臀、臂、大腿围目标必须大于当前值；引擎会将对应肌群加入更多训练日，强化直接刺激。
- 当只填写一个围度目标时，计划仍以该“单点目标”为优先：例如臂围会加入肱二头与肱三头动作；臀围加入臀部动作；大腿围加入股四头与腘绳肌动作。
- 页面展示“计划生成逻辑”：输入评估、BMR/TDEE/热量计算、宏量分配、训练决策及科学依据。
- 生成每日热量、蛋白质/脂肪/碳水、力量训练、有氧安排、体重趋势与风险提示。
- 使用真实身体指标、训练和饮食历史进行复评，并返回可立即应用的 `updatedPlan` 与 `updatedInput`。

### 计划逻辑与科学依据

1. **能量消耗**：有体脂率时优先使用 Katch–McArdle（基于瘦体重）估算 BMR；没有体脂率时使用 Mifflin–St Jeor。TDEE = BMR × 活动系数。
2. **热量目标**：根据目标类型、目标日期和目标体重变化速度形成有边界的热量缺口或盈余；减脂缺口被限制在每日 250–800 kcal，避免通过极端低热量追求短期结果。
3. **宏量营养**：蛋白质按体重和目标类型设置，脂肪保留基础摄入，剩余热量给碳水以支持活动和训练表现。
4. **训练剂量**：所有计划保留主要肌群的全身覆盖；有围度增大目标时，目标肌群会重复出现在每周训练中。结果仍取决于动作质量、渐进超负荷、恢复、睡眠与执行一致性。
5. **围度边界**：腰围不是“练腹”即可定向缩小；胸、臀、臂、大腿围增加也无法保证在某个固定日期准确达到。系统给出可执行方向和可复评路径，而非医学或效果承诺。

### 本地运行

要求：Node.js 22 或更高版本。

```bash
npm test
npm start
```

打开 [http://localhost:3000](http://localhost:3000) 使用浏览器验证界面。

### Android 下载安装

离线 Android MVP 位于 [`android/shape-plan-android`](android/shape-plan-android)。计划生成、目标自动修正、围度聚焦和训练强度规则都内置在应用中，安装后不依赖开发服务器。

当前发布版本：`android-v1.0.5`。该版本在 `android-v1.0.4` 的基础上，补齐 Android 与 Web 的多场景一致性：支持 2/3/4/5/6 天不同训练拆分、日常活动与单次训练时长输入、保持目标、居家动作不混入健身房器械动作，并用场景矩阵测试覆盖性别、目标类型、训练场景、训练频率和围度目标组合。动作计划继续按“动作指导、建议重量、建议次数、建议组数、PR 估计、安排原因”的结构展示。

1. 推送 `android-v*` 格式的标签后，GitHub Actions 会构建 APK 并发布到 Releases。
2. 手动运行 GitHub 的 **Build Android APK** 工作流，也会在工作流产物中提供可下载 APK。
3. 这是用于产品验证的 debug APK，未使用 Play 商店签名；Android 可能要求在浏览器或文件管理器中允许安装未知来源应用。

### API

| Endpoint | 说明 |
| --- | --- |
| `GET /` | 响应式浏览器验证界面。 |
| `GET /health` | 健康检查。 |
| `POST /api/plan/generate` | 校验输入并生成可解释的规则计划。 |
| `POST /api/plan/review` | 复评历史数据并返回 `updatedInput` 与 `updatedPlan`。 |

### 生成计划示例：单点臂围目标

```bash
curl -X POST http://localhost:3000/api/plan/generate \
  -H 'Content-Type: application/json' \
  -d '{
    "sex": "male",
    "age": 30,
    "heightCm": 175,
    "weightKg": 82,
    "bodyFatPct": 20,
    "goal": { "type": "muscle_gain", "targetDate": "2026-12-31", "targetWeightKg": 85 },
    "currentCircumference": { "armCm": 34 },
    "goalCircumference": { "armCm": 36 },
    "trainingMode": "gym",
    "frequencyPerWeek": 4,
    "sessionMinutes": 60
  }'
```

返回的 `planningLogic` 提供展示用的输入评估、计算过程、训练决策和依据；`measurementFocus` 列出实际用于调整训练的围度目标。

### 安全边界

这是计划与教育工具，不构成医疗诊断或治疗建议。存在疾病、妊娠、未成年、饮食失调风险或术后恢复需求时，请先咨询合格的医疗或运动专业人士。

---

## English Summary

A zero-dependency Node.js fitness-planning MVP with a responsive browser client. It supports fat loss, muscle gain, recomposition, maintenance, paired current/target circumference inputs, rule-based training prioritization, transparent planning logic, and history-based plan reviews.

Run `npm test` and `npm start`, then open [http://localhost:3000](http://localhost:3000).

### Android installation

The offline Android MVP is in [`android/shape-plan-android`](android/shape-plan-android). Its plan generation, goal normalization, circumference emphasis, and intensity rules run inside the app, without a development server.

Current release: `android-v1.0.5`. Building on `android-v1.0.4`, this release aligns Android and Web behavior across scenarios: 2/3/4/5/6-day splits, daily activity and session-length inputs, maintenance goals, home plans that avoid gym-only equipment, and a scenario matrix test covering sex, goal type, training mode, weekly frequency, and circumference targets. The daily workout layout still shows guide, suggested weight, suggested reps, suggested sets, PR estimate, and arrangement reason.

1. Push an `android-v*` tag to build and publish an APK in GitHub Releases.
2. You can also run the **Build Android APK** GitHub workflow manually and download its APK artifact.
3. This is a product-validation debug APK, not Play Store signed. Android may ask the user to allow installation from the browser or file manager.
