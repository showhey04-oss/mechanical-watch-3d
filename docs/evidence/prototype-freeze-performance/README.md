# Prototype freeze performance evidence

- source main: `eb4595e040786e0e2115165d36a9cc39e08b2038`
- app: `v3.15.0`
- classification: `ENVIRONMENT_QUALIFIED_BASELINE`
- reports: 18
- product tree changes: 0
- capture: Installed Chrome, 1280×720 and 390×844, transient instrumentation

`raw/`の18 JSONはブラウザがPOSTした未転記の実測値です。`performance-baseline-source.json`はrawを機械的に要約し、HANDOFF_SPECへ同内容を複製します。背景プロセスを停止していないためabsolute clean-process PASSを主張しません。

Desktop／Mobileのdefault completed-watch、opacity 26%、split、explode、selection、exterior OFF、legacyおよびpointer／wheelを取得しました。全runでv3.15.0、初期作動音OFF、console error／warning、runtime error、unhandled rejection 0です。
