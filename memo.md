## Sparebeat Map Maker の開発向け仕様書

### MainScene 内のメンバ変数
* notetype: 選択されているノーツの種類
* level: 難易度(E/N/H)
* json: 出力されるjsonのObject
* time: (未解明)
* notesdata: ノーツのデータを格納するObject
    * notesdata[str][i][j] = 難易度strの譜面のi列目のj個目のノーツの種類
* tripletnotesdata: (未解明)
* notesCount: (未解明)
* notesCountofBar: (未解明)
* attackNotesCount: (未解明)
* attackNotesCountofBar: (未解明)
* lengths: (未解明)
* screenBottom: 画面最下部に対応するDisplayElement
* score: (未解明)
* dencityGraph: ノーツの密度グラフ(画面左部)に対応するDisplayElement
* limitline: (未解明)
* notesCountofBar: (未解明)
* attackNotesCountofBar: (未解明)
* currentpos: 譜面中の現在位置を示すバーに対応するShape
* extend: 小節数を増やすボタンに対応するButton
* cut: 小節数を減らすボタンに対応するButton
* s: (未解明)
* notes: (未解明)
* tripletnotes: (未解明)
* notesCountLabel: ノーツの個数・割合を示す表示に対応するLabel

### その他のクラス
* Lengths: 各小節の長さを管理するクラス
* LoadMenuScene: (未解明)
* SaveData: (未解明)
* MetaSettingScene: (未解明)
* InfiniteOf: (未解明)
* List: (未解明)
