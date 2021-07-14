// 現在未使用。title/bpm/artist/startTimeを編集する画面になるはずだった。
phina.define('MetaSettingScene', {
	superClass: 'phina.display.DisplayScene',
	init: function(json) {
		this.superInit();
		this.backgroundColor = "#4444";
		this.json = json;
	},
	onpointstart: function() {
		this.exit();
	}
});
