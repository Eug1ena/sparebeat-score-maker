phina.define("TitleScene", {
    superClass: "phina.display.DisplayScene",
    init: function() {
        this.superInit();

        // 各セーブデータのkeyは"json"(譜面データ)と"changed"
        const saves = JSON.parse(localStorage.getItem("saves") || "[]");

        this.center = DisplayElement({x: SCREEN_CENTER_X, y: this.height / 2}).addChildTo(this);

        this.chartElements = [];
        const newChartElem = RectangleShape({
            width: SCREEN_WIDTH,
            height: 70,
            x: 0,
            y: -160,
            fill: "#ffd4f1",
            stroke: null
        }).addChildTo(this.center);
        this.chartElements.push(newChartElem);
        Label({
            x: 0, y: 0,
            text: "Create New Chart",
            fontSize: 25
        }).addChildTo(newChartElem);

        for(let i = 0; i < saves.length; i++){
            const elem = RectangleShape({
                width: SCREEN_WIDTH,
                height: 150,
                x: 0,
                y: 200 * i,
                fill: i === 0 ? "#ffb0e5" : "#ffd4f1",
                stroke: null
            }).addChildTo(this.center);
            this.chartElements.push(elem);

            Label({
                x: 0, y: -20,
                text: saves[i].json.title,
                fontSize: 35
            }).addChildTo(elem);
            Label({
                x: 0, y: 30,
                text: "by " + saves[i].json.artist,
                fontSize: 25
            }).addChildTo(elem);
        }
        this.selectedIndex = this.chartElements.length == 1 ? 0 : 1;

        shortcut.add("Up", function() {
            if(this.selectedIndex >= 1) {
                this.chartElements[this.selectedIndex].fill = "#ffd4f1";
                this.selectedIndex--;
                this.chartElements[this.selectedIndex].fill = "#ffb0e5";

                this.chartElements.forEach(function(v) {
                    v.y += 200;
                });
            }
        }.bind(this));
        shortcut.add("Down", function() {
            if(this.selectedIndex < this.chartElements.length - 1) {
                this.chartElements[this.selectedIndex].fill = "#ffd4f1";
                this.selectedIndex++;
                this.chartElements[this.selectedIndex].fill = "#ffb0e5";

                this.chartElements.forEach(function(v) {
                    v.y -= 200;
                });
            }
        }.bind(this));

        shortcut.add("Space", function() {
            if(this.selectedIndex == 0) this.goToMainScene(undefined, null);
            else this.goToMainScene(this.selectedIndex - 1, saves[this.selectedIndex - 1].json);
        }.bind(this));
        shortcut.add("Enter", function() {
            if(this.selectedIndex == 0) this.goToMainScene(undefined, null);
            else this.goToMainScene(this.selectedIndex - 1, saves[this.selectedIndex - 1].json);
        }.bind(this));
    },
    update: function() {
        this.center.y = this.height / 2;
    },
    goToMainScene: function(id, json) {
        shortcut.remove("Up");
        shortcut.remove("Down");
        shortcut.remove("Space");
        shortcut.remove("Enter");
        this.exit({
            id: id,
            json: json
        });
    }
});
