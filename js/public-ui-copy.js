const PUBLIC_PART_NAME_OVERRIDES = Object.freeze({
  "OPEN_HEART_PRESENTATION_CUTOUT 地板core": "オープンハート地板（本体）",
  "OPEN_HEART_PRESENTATION_CUTOUT 地板topStep": "オープンハート地板（上面）",
  "OPEN_HEART_PRESENTATION_CUTOUT 地板bottomStep": "オープンハート地板（文字板側）",
});

const PUBLIC_PART_DESCRIPTION_OVERRIDES = Object.freeze({
  "E-BALANCED ケース胴": "時計内部を囲み、ベゼルと裏蓋を支えるケース胴です。りゅうず周辺には操作に必要なすき間を設けています。",
  "E-BALANCED ベゼル": "風防の外周を保持し、文字板の表示開口を形づくる環状部品です。",
  "E-BALANCED 風防": "文字板と針を覆い、正面から保護する透明部品です。",
  "E-BALANCED リハウト": "ベゼルの表示開口と文字板外周をつなぐ内周リングです。",
  "E-BALANCED 物理文字板": "時刻表示の土台となる文字板です。中央の管と小秒軸を通す開口を持ちます。",
  "E-BALANCED 裏蓋リング": "裏蓋の透明窓を保持し、ケース胴の裏側を閉じる環状部品です。",
  "E-BALANCED シースルー窓": "ムーブメントを裏側から観察できる透明窓です。",
  "E-BALANCED ムーブメント保持リング": "ケース内でムーブメント外周を支える保持リングです。",
  "E-BALANCED 中空りゅうずチューブ": "ケースを貫通する巻真を案内し、りゅうずの取付部を支える中空管です。",
  "E-BALANCED りゅうず接続カラー": "ケース胴とりゅうずチューブの間をつなぐ環状部品です。",
  "E-BALANCED 簡略バックル": "ストラップを留めるための尾錠です。",
  "Phase 3C.1 アイボリー文字板": "時刻表示の土台となるアイボリー文字板です。小秒表示と、調速機を見せるオープンハートを備えます。",
  "Phase 3C.1 小秒表示": "6時位置で秒を表示する小秒盤です。小秒針は四番車軸と同じ中心で回転します。",
  "Phase 3C.1 小秒凹部ベベル": "小秒盤の周囲に段差をつくり、主文字板との境界を示す斜面です。",
  "Phase 3C.1 バーインデックス": "文字板上で時刻位置を示す立体バーです。12時位置は2本のバーで強調しています。",
  "Phase 3C.1 分目盛": "文字板外周で分と秒の位置を示す60個の丸型目盛です。",
  "Phase 3C.1 小秒目盛": "小秒盤上で秒の位置を示す目盛です。5秒ごとの主要目盛を長くしています。",
  "Phase 3C.1 オープンハート縁": "オープンハート開口を囲み、文字板の縁を保護する金属リングです。",
  "Phase 3C.1 オープンハート開口": "文字板越しにテンプと脱進機の動きを観察するための開口です。",
  "Phase 3C.1 分針": "分を示す針です。筒かな管と同じ角度で回転します。",
  "Phase 3C.1 時針": "時を示す針です。時針管と同じ角度で回転します。",
  "Phase 3C.1 小秒針": "秒を示す小さな針です。四番車軸と同じ角度で回転します。",
  "Phase 3C.1 ドーム風防": "文字板と針を覆う、中央が緩やかにふくらんだ透明風防です。",
  "OPEN_HEART_PRESENTATION_CUTOUT 地板core": "テンプ下の軸受支持を残しながら、オープンハートから機構を見せる地板本体です。",
  "OPEN_HEART_PRESENTATION_CUTOUT 地板topStep": "地板上面の支持部を残しながら、オープンハートから機構を見せる加工層です。",
  "OPEN_HEART_PRESENTATION_CUTOUT 地板bottomStep": "文字板側の支持部を残しながら、オープンハートから機構を見せる加工層です。",
  "Phase 3C.2 12時側黒革ストラップ": "尾錠側を構成する黒革ストラップです。ケース側ではスプリングバーを包み、反対側で尾錠を支えます。",
  "Phase 3C.2 6時側黒革ストラップ": "剣先と7個の調整穴を備えた黒革ストラップです。",
  "Phase 3C.2 尾錠枠": "ストラップを通して保持するシルバーの尾錠枠です。",
  "Phase 3C.2 尾錠取付バー": "尾錠枠、つく棒、革の巻込み部を同じ軸上で支える取付バーです。",
  "Phase 3C.2 つく棒": "ストラップの調整穴へ通して装着位置を固定する尾錠のつく棒です。",
  "Phase 3C.2 定革": "尾錠の近くで剣先を保持する固定式の革輪です。",
  "Phase 3C.2 遊革": "定革の先で剣先を保持する可動式の革輪です。",
  "角穴車角穴筒": "中央の角穴で香箱真角部を囲み、角穴車と香箱真を一体で回転させます。",
  "巻上げピニオン": "巻上げクラッチから受けた回転を、丸穴車のクラウン歯へ伝えます。",
  "角穴車": "りゅうずからの回転を香箱真へ伝え、主ゼンマイを巻き上げます。",
  "設定車1": "時刻合わせの回転を設定車2へ伝えます。",
  "設定車2": "設定車1から受けた回転をミニッツホイールへ伝えます。",
  "設定中間車18歯": "時刻合わせの回転を設定車1へ伝える中間車です。",
  "ガンギ車15歯": "輪列から受けた動力をアンクルへ断続的に伝え、輪列の進みを制御します。",
  "テンプ輪": "往復振動によって時計の進む速さを整えます。アンクルと協調して脱進機を一定周期で動かします。",
  "巻上げ固定クラッチ": "巻上げ時に移動クラッチとつながり、りゅうずの回転を巻上げ輪列へ伝えます。",
  "二位置移動クラッチ": "りゅうずの操作に応じて、巻上げと時刻合わせの伝達先を切り替えます。",
  "設定入力クラッチ": "時刻合わせ時に移動クラッチとつながり、回転を設定輪列へ伝えます。",
  "巻真一体軸": "りゅうずの回転と前後の操作を内部機構へ伝える軸です。",
  "りゅうず": "巻上げと時刻合わせを行うための操作部です。",
  "分針": "分を示す針です。筒かな管と同じ角度で回転します。",
  "時針": "時を示す針です。時針管と同じ角度で回転します。",
  "小秒針": "秒を示す小さな針です。四番車軸と同じ角度で回転します。",
});

const stripDevelopmentPrefix = name => String(name || "")
  .replace(/^Phase 3C\.1\s+/, "")
  .replace(/^Phase 3C\.2\s+/, "")
  .replace(/^E-BALANCED\s+/, "")
  .replace(/\s+refined lug$/, "ラグ");

const standardizeCrownWords = text => String(text || "")
  .replaceAll("位置1", "巻上げ")
  .replaceAll("位置2", "時刻合わせ")
  .replaceAll("両Object3D", "両部品")
  .replaceAll("実Object3D角", "回転角")
  .replaceAll("Object3D", "部品");

const removeImplementationHistory = text => standardizeCrownWords(text)
  .replaceAll("ピッチ半径和", "かみ合い位置")
  .replaceAll("実回転", "回転")
  .replaceAll("実形状でも", "")
  .replace(/(?:^|。)[^。]*(?:追加した|変更した|整えた)[^。]*。?/g, "")
  .replace(/\s{2,}/g, " ")
  .trim();

export function getPublicPartName(internalName) {
  return PUBLIC_PART_NAME_OVERRIDES[internalName]
    ?? stripDevelopmentPrefix(internalName);
}

export function getPublicPartDescription(internalName, sourceDescription) {
  if (/^E-BALANCED .+ラグ$/.test(internalName)
    || /^Phase 3C\.2 .+ refined lug$/.test(internalName)) {
    return "ケースとスプリングバーをつなぎ、ストラップを支えるラグです。";
  }
  if (/^E-BALANCED .+スプリングバー$/.test(internalName)) {
    return "ラグの間でストラップの巻込み部を支える取付軸です。";
  }
  if (/^E-BALANCED .+ストラップ$/.test(internalName)) {
    return "ケースと尾錠をつなぎ、腕へ装着するためのストラップです。";
  }
  return removeImplementationHistory(
    PUBLIC_PART_DESCRIPTION_OVERRIDES[internalName] ?? sourceDescription,
  );
}

export const PUBLIC_UI_COPY_CONTRACT = Object.freeze({
  internalIdentifierChanged: false,
  behaviorChanged: false,
  unavailableSelectionText: "部品を選択すると説明を表示します。",
  crownLabels: Object.freeze({ wind: "巻上げ", set: "時刻合わせ" }),
});
