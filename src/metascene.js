// 現在未使用。title/bpm/artist/startTimeを編集する画面になるはずだった。
phina.define('MetaSettingScene', {
	superClass: 'phina.display.DisplayScene',
	init: function(json) {
		this.superInit();
		this.backgroundColor = "#4444";
		this.json = json;

		RectangleShape({width: 650, height: 100, x: 480, y: 140, fill: "#eee", stroke: null}).addChildTo(this);
		RectangleShape({width: 650, height: 100, x: 480, y: 270, fill: "#888c", stroke: null}).addChildTo(this);
		RectangleShape({width: 650, height: 100, x: 480, y: 400, fill: "#888c", stroke: null}).addChildTo(this);

		// const deleteButton = Button({x: 735, y: 155, fill: "#422", text: "Change", width: 100, height: 40, fontSize: 16}).addChildTo(this);
        // deleteButton.on('pointstart', function() {
        //     this.childclicked = true;
        //     this.flare('delete');
        //     this.remove();
        // }.bind(this));

		// RectangleShape({width: 500, height: 50, x: 520, y: 125, fill: "#ddd", stroke: null}).addChildTo(this);

		Label({x: 190, y: 120, align: "left", fontSize: 25, text: "TITLE: That&s mya nae", fill: "black"}).addChildTo(this);
		Label({x: 190, y: 250, align: "left", fontSize: 25, text: "BPM: 700", fill: "black"}).addChildTo(this);
		Label({x: 190, y: 380, align: "left", fontSize: 25, text: "ARTIST: 700", fill: "black"}).addChildTo(this);

	},
	onpointstart: function() {
		this.exit();
	}
});
