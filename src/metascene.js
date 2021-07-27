// 現在未使用。title/bpm/artist/startTimeを編集する画面になるはずだった。
phina.define("MetaSettingScene", {
	superClass: "phina.display.DisplayScene",
	init: function(json) {
		this.superInit();
		this.backgroundColor = "#666666da";
		this.json = json;

		EditableLine(this, 120, "タイトル", this.json.title);
		EditableLine(this, 180, "アーティスト", this.json.artist);
		EditableLine(this, 240, "BPM", this.json.bpm);
		EditableLine(this, 300, "StartTime", this.json.startTime);
		EditableLine(this, 360, "レベル(Easy)", this.json.level["easy"]);
		EditableLine(this, 420, "レベル(Normal)", this.json.level["normal"]);
		EditableLine(this, 480, "レベル(Hard)", this.json.level["hard"]);

	},
	onpointstart: function() {
		this.exit();
	}
});

phina.define("EditableLine", {
    superClass: "phina.display.Shape",
    init: function(scene, y, title, value) {
        this.superInit();

		Label({x: 180, y: y, align: "left", fontSize: 27, text: title, fill: "#eee"}).addChildTo(scene);
		Label({x: 780, y: y, align: "right", fontSize: 27, text: value, fill: "#eee"}).addChildTo(scene);

    }
});
