// title/bpm/artist/startTimeを編集する画面。
phina.define("MetaSettingScene", {
	superClass: "phina.display.DisplayScene",
	init: function(main) {
		this.superInit();
		this.backgroundColor = "#666666da";
		this.main = main;
		this.json = this.main.json;

		const top = 120, margin = 60;

		this.isEdited = false;

		EditableLine(this, top + margin * 0, "タイトル", this.json.title, function(label) {
			const ret = prompt("曲のタイトルを入力してください。", this.json.title);
			if(ret){
				this.json.title = ret;
				label.text = ret;
				this.isEdited = true;
            }
		}.bind(this));
		EditableLine(this, top + margin * 1, "アーティスト", this.json.artist, function(label) {
			const ret = prompt("アーティスト名を入力してください。", this.json.artist);
			if(ret){
				this.json.artist = ret;
				label.text = ret;
				this.isEdited = true;
            }
		}.bind(this));
		EditableLine(this, top + margin * 2, "BPM", this.json.bpm, function(label) {
			const ret = prompt("BPMを入力してください。", this.json.bpm);
			if(ret){
				const bpm = parseFloat(ret);
				if(bpm || bpm === 0){
					this.json.bpm = bpm;
					label.text = bpm;
					this.isEdited = true;
				}else{
					alert("無効な数値です。");
				}
			}
		}.bind(this));
		EditableLine(this, top + margin * 3, "startTime", this.json.startTime, function(label) {
			const ret = prompt("startTimeを入力してください。", this.json.startTime);
			if(ret){
				const startTime = parseInt(ret);
				if(startTime || startTime === 0){
					this.json.startTime = startTime;
					label.text = startTime;
					this.isEdited = true;
				}else{
					alert("無効な数値です。");
				}
			}
		}.bind(this));
		EditableLine(this, top + margin * 4, "レベル(Easy)", this.json.level["easy"], function(label) {
			const ret = prompt("Easyのレベルを入力してください。", this.json.level["easy"]);
			if(ret){
				this.json.level["easy"] = ret;
				label.text = ret;
				this.isEdited = true;
			}
		}.bind(this));
		EditableLine(this, top + margin * 5, "レベル(Normal)", this.json.level["normal"], function(label) {
			const ret = prompt("Normalのレベルを入力してください。", this.json.level["normal"]);
			if(ret){
				this.json.level["normal"] = ret;
				label.text = ret;
				this.isEdited = true;
			}
		}.bind(this));
		EditableLine(this, top + margin * 6, "レベル(Hard)", this.json.level["hard"], function(label) {
			const ret = prompt("Hardのレベルを入力してください。", this.json.level["hard"]);
			if(ret){
				this.json.level["hard"] = ret;
				label.text = ret;
				this.isEdited = true;
			}
		}.bind(this));

	},
	onpointstart: function() {
        if (this.childclicked) this.childclicked = false;
		else {
			if (this.isEdited) this.main.save();
			this.main.updateInformation();
			this.exit();
		}
	}
});

phina.define("EditableLine", {
    superClass: "phina.display.Shape",
    init: function(scene, y, title, value, update) {
        this.superInit();

		Label({x: 180, y: y, align: "left", fontSize: 27, text: title, fill: "#eee"}).addChildTo(scene);
		const valueLabel = Label({x: 780, y: y, align: "right", fontSize: 27, text: value, fill: "#eee"}).addChildTo(scene);
		valueLabel.on("pointstart", function(){
			scene.childclicked = true;
			update(valueLabel);
		}.bind(this)).setInteractive(true);

		valueLabel.on("pointover", function(){ this.fill = "#ccc"; }).on("pointout", function(){ this.fill = "#eee"; });
    }
});
