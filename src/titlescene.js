phina.define("TitleScene", {
    superClass: "phina.display.DisplayScene",
    init: function() {
        this.superInit();

        // 各セーブデータのkeyは"json"(譜面データ)と"changed"
        const saves = JSON.parse(localStorage.getItem("saves") || "[]");

        this.center = DisplayElement({x: SCREEN_CENTER_X, y: this.height / 2}).addChildTo(this);
        const group = List(true, 35, {y: -195}).addChildTo(this.center);

        this.chartElements = [];
        const newChartElem = RectangleShape({
            width: SCREEN_WIDTH,
            height: 60,
            x: 0,
            y: -160,
            fill: "#ffd4f1",
            stroke: null
        }).addChildTo(group);
        this.chartElements.push({elem: newChartElem});
        Label({
            x: 0, y: 0,
            text: "Create New Chart",
            fontSize: 24
        }).addChildTo(newChartElem);

        saves.forEach(function(chart, index) {
            const elem = RectangleShape({
                width: SCREEN_WIDTH,
                height: 135,
                fill: index === 0 ? "#ffb0e5" : "#ffd4f1",
                stroke: null
            }).addChildTo(group);
            this.chartElements.push({elem: elem, number: index});

            Label({
                x: 0, y: -20,
                text: chart.json.title,
                fontSize: 30
            }).addChildTo(elem);
            Label({
                x: 0, y: 25,
                text: "by " + chart.json.artist,
                fontSize: 24
            }).addChildTo(elem);

            const deleteButton = Button({x: 400, y: 40, fill: "#524b4b", text: "Delete", width: 90, height: 35, fontSize: 14}).addChildTo(elem);
            deleteButton.on("pointstart", function() {
                if (window.confirm(chart.json.title + "の譜面を本当に削除しますか？")) {
                    goUp();

                    const item = this.chartElements.find(v => v.number === index);
                    const indexInArray = this.chartElements.indexOf(item) - 1;
                    saves.splice(indexInArray, 1);
                    this.chartElements.splice(indexInArray + 1, 1);
                    localStorage.setItem("saves", JSON.stringify(saves));

                    console.log(indexInArray);

                    const elem = item.elem;
                    elem.remove();
                }
            }.bind(this));
        }.bind(this));
        this.selectedIndex = this.chartElements.length == 1 ? 0 : 1;

        const goUp = function() {
            // console.log(this.chartElements);
            if(this.selectedIndex >= 1) {
                this.chartElements[this.selectedIndex].elem.fill = "#ffd4f1";
                this.selectedIndex--;
                this.chartElements[this.selectedIndex].elem.fill = "#ffb0e5";

                group.y += 135 + 35;
            }
        }.bind(this);
        const goDown = function() {
            // console.log(this.chartElements);
            if(this.selectedIndex < this.chartElements.length - 1) {
                this.chartElements[this.selectedIndex].elem.fill = "#ffd4f1";
                this.selectedIndex++;
                this.chartElements[this.selectedIndex].elem.fill = "#ffb0e5";

                group.y -= 135 + 35;
            }
        }.bind(this);
        shortcut.add("Up", goUp);
        shortcut.add("Down", goDown);

        shortcut.add("Space", function() {
            if(this.selectedIndex == 0) this.goToMainScene(undefined, null);
            else this.goToMainScene(this.selectedIndex - 1, saves[this.selectedIndex - 1].json);
        }.bind(this));
        shortcut.add("Enter", function() {
            if(this.selectedIndex == 0) this.goToMainScene(undefined, null);
            else this.goToMainScene(this.selectedIndex - 1, saves[this.selectedIndex - 1].json);
        }.bind(this));

        this.upperRight = DisplayElement({x: 0, y: 0}).addChildTo(this);
        const instructionLabel = Label({
            text: "Move - ↑ or ↓\nSelect - Space or Enter",
            fontSize: 18,
            fontFamily: "Nova Mono",
            align: "left",
            baseline: "top",
            x: 20, y: 30
        });

        WebFont.load({
            custom: {
                families: ["Nova Mono"]
            },
            active: function() {
                instructionLabel.addChildTo(this.upperRight);
            }.bind(this),
            inactive: function() {
                instructionLabel.addChildTo(this.upperRight);
            }.bind(this)
        });

        // this.on("enter", function(e) {
        //     e.app.domElement.addEventListener("dragover", function(event) {
        //         event.preventDefault();
        //         event.dataTransfer.dropEffect = "copy";
        //     });
        //     e.app.domElement.addEventListener("drop", function(event) {
        //         event.preventDefault();
        //         importFile(event.dataTransfer.files[0]);
        //     });
        // });
    },
    update: function() {
        this.center.y = this.height / 2;
        // this.lowerRight.y = this.height;
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
