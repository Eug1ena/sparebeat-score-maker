const SCREEN_WIDTH = 960;
const SCREEN_CENTER_X = SCREEN_WIDTH / 2;

phina.globalize();

phina.display.DisplayScene.defaults.$extend({
    width: SCREEN_WIDTH,
});
phina.game.LoadingScene.defaults.$extend({
    width: SCREEN_WIDTH,
    height: 640
});

phina.ui.Button.defaults.$extend({
    width: 160,
    height: 64,
    fontSize: 24
});

const BARS_COUNT_INITIAL = 100;

const NOTHING = 0;
const NORMAL = 1;
const ATTACK = 2;
const LONG_START = 3;
const LONG_END = 4;

const START = 5;
const END = 6;

const LANES = [0, 1, 2, 3, "bind", "random"];

function colorOf(id, mode) {
    if (id === NOTHING) return 'black';
    else if (id === NORMAL) return mode ? '#333388' : '#2222bb';
    else if (id === ATTACK) return mode ? '#661111' : '#aa0000';
    else if (id === LONG_START) return mode ? '#888811' : '#aaaa00';
    else if (id === LONG_END) return mode ? '#118888' : '#00aaaa';
}

// やっぱりコードが汚い… 自分で言うのもアレですがいっそ書き直した方がいいような気がしている
phina.define("MainScene", {
    superClass: "phina.display.DisplayScene",
    init: function(param) {
        this.superInit();
        this.notetype = NORMAL;
        this.level = "normal";
        this.id = param.id;
        this.json = param.json || {
            title: "Lorem Ipsum",
            artist: "Dolor",
            bpm: 158,
            startTime: 80,
            level: {
                easy: 4,
                normal: 7,
                hard: 9
            },
            map: {}
        };

        this.NOTES_INTERVAL = 30;
        shortcut.add("Ctrl+Shift+Up", function() {
            if(this.NOTES_INTERVAL == 30) this.NOTES_INTERVAL = 35;
            if(this.NOTES_INTERVAL == 25) this.NOTES_INTERVAL = 30;
            if(this.NOTES_INTERVAL == 20) this.NOTES_INTERVAL = 25;

            this.updateNotesInterval();
        }.bind(this));
        shortcut.add("Ctrl+Shift+Down", function() {
            if(this.NOTES_INTERVAL == 25) this.NOTES_INTERVAL = 20;
            if(this.NOTES_INTERVAL == 30) this.NOTES_INTERVAL = 25;
            if(this.NOTES_INTERVAL == 35) this.NOTES_INTERVAL = 30;

            this.updateNotesInterval();
        }.bind(this));

        // 以下lengthsまで各難易度ごとのデータ
        this.barsCount = { easy: BARS_COUNT_INITIAL, normal: BARS_COUNT_INITIAL, hard: BARS_COUNT_INITIAL}; // 小節数

        // ここは列挙型のようなものに置き換えるべきなように思う
        this.notesData = { easy: [], normal: [], hard: []}; // 3連符でない部分の譜面を表す表
        this.tripletNotesData = { easy: [], normal: [], hard: []}; // 3連符である部分の譜面を表す表
        this.noteButtons = []; // 3連符でない音符のボタンを表す表
        this.tripletNoteButtons = { easy: [], normal: [], hard: []}; // 3連符である音符のボタンを表す表

        // この4つはクラスにまとめるべきか
        this.notesCount = { easy: 0, normal: 0, hard: 0}; // 譜面全体のノーツ数
        this.notesCountOfBar = { easy: [], normal: [], hard: []}; // 小節ごとのノーツ数
        // 以下アタックノーツに絞った数
        this.attackNotesCount = { easy: 0, normal: 0, hard: 0};
        this.attackNotesCountOfBar = {easy: [], normal: [], hard: []};

        this.lengths = { easy: Lengths(), normal: Lengths(), hard: Lengths()};
        this.screenBottom = DisplayElement({y: this.height}).addChildTo(this);
        this.score = DisplayElement({x: SCREEN_CENTER_X}).addChildTo(this.screenBottom);
        this.dencityGraph = DisplayElement({y: -9}).addChildTo(this.screenBottom);
        this.dencityGraph.alpha = 0.3;
        this.limitline = PathShape({x: 8 + 240 / 9, strokeWidth: 2, paths: [Vector2(0, 0), Vector2(0, this.height)]}).addChildTo(this);
        // Label({x: 68, y: -40, fontSize: 12, text: "10notes/s"}).addChildTo(this.screenBottom);
        this.notesCountOfBar.forIn(function(k, v) {v.fill(0, 0, BARS_COUNT_INITIAL)});
        this.attackNotesCountOfBar.forIn(function(k, v) {v.fill(0, 0, BARS_COUNT_INITIAL)});
        this.currentPos = RectangleShape({
            width: 100,
            height: 10,
            x: 48,
            y: 2,
            fill: "gray",
            stroke: null
        }).addChildTo(this.screenBottom).setOrigin(0.5, 1);
        this.currentPos.alpha = 0.3;

        this.extend = Button({x: -320, y: 40 - BARS_COUNT_INITIAL * this.NOTES_INTERVAL * 16, text: "+", width: 48, height: 48}).on("pointstart", function() {
            this.barsCount[this.level]++;
            if (this.lengths[this.level].length < this.barsCount[this.level]) this.lengths[this.level].push(16);
            this.updateBarsCount();
            this.save();
        }.bind(this)).addChildTo(this.score);
        this.cut = Button({x: -320, y: 520 - BARS_COUNT_INITIAL * this.NOTES_INTERVAL * 16, text: "-", width: 48, height: 48}).on("pointstart", function() {
            this.barsCount[this.level]--;
            this.lengths[this.level].cut();
            this.updateBarsCount();
            this.save();
        }.bind(this)).addChildTo(this.score);

        this.currentLinePos = 0;
        this.currentLine = RectangleShape({
            width: 400,
            height: this.NOTES_INTERVAL,
            x: 0,
            y: -15,
            fill: colorOf(NORMAL),
            stroke: null
        }).addChildTo(this.score);
        this.currentLine.alpha = 0.15;

        this.s = InfiniteOf(function(i) {
            if (this.lengths[this.level].sum.includes(i) || i === 0) {
                const group = DisplayElement();
                PathShape({paths: [Vector2(-1000, 0), Vector2(1000, 0)]}).addChildTo(group);
                Label({
                    x: -360, y: -14,
                    text: i === 0 ? 0 : this.lengths[this.level].sum.indexOf(i) + 1,
                    fontFamily: "Nova Mono"
                }).addChildTo(group);
                return group;
            }
            for (let j = 0; j < this.lengths[this.level].length; j++) {
                if (this.lengths[this.level].sum[j] > i) {
                    if (this.lengths[this.level].diff[j] % 4 === 0 && (i - (j === 0 ? 0 : this.lengths[this.level].sum[j - 1])) % 4 === 0) return PathShape({paths: [Vector2(-1000, 0), Vector2(1000, 0)], y: -1, strokeWidth: 1, stroke: "#cccccc"});
                    return Element();
                }
            }
            return Element();
        }.bind(this), Vector2(0, -this.NOTES_INTERVAL)).addChildTo(this.score);

        this.notes = InfiniteOf(function(i) {
            if (!this.notesData[this.level][i]) {
                this.notesData[this.level][i] = [NOTHING, NOTHING, NOTHING, NOTHING];
                this.notesData[this.level][i].bind = NOTHING;
                this.notesData[this.level][i].random = NOTHING;
            }
            if (!this.noteButtons[i]) {
                this.noteButtons[i] = [null, null, null, null];
            }
            const root = DisplayElement();
            if (this.lengths[this.level].sum.includes(i)) {
                Button({x: -140, y: 22, text: "+", width: 36, height: 36}).on("pointstart", function() {
                    const index = this.lengths[this.level].sum.indexOf(i);
                    this.lengths[this.level].set(index, this.lengths[this.level].diff[index] + 1);
                    this.notes.reset();
                    this.updateBarsCount();
                    this.save();
                }.bind(this)).addChildTo(root);

                Button({x: -140, y: 66, text: "-", width: 36, height: 36}).on("pointstart", function() {
                    const index = this.lengths[this.level].sum.indexOf(i);
                    this.lengths[this.level].set(index, this.lengths[this.level].diff[index] - 1);
                    this.notes.reset();
                    this.updateBarsCount();
                    this.save();
                }.bind(this)).addChildTo(root);
            }
            const group = DisplayElement({width: 225, height: 28, y: -this.NOTES_INTERVAL / 2}).addChildTo(root);
            const self = this;
            if(LANES.some(function (lane) {
                return this.tripletNotesData[this.level][Math.floor(i / 2) * 3] && this.tripletNotesData[this.level][Math.floor(i / 2) * 3][lane] !== NOTHING || this.tripletNotesData[this.level][Math.floor(i / 2) * 3 + 1] && this.tripletNotesData[this.level][Math.floor(i / 2) * 3 + 1][lane] !== NOTHING || this.tripletNotesData[this.level][Math.floor(i / 2) * 3 + 2] && this.tripletNotesData[this.level][Math.floor(i / 2) * 3 + 2][lane] !== NOTHING;
            }, this)) for (let j = 0; j < 4; j++) RectangleShape({x: j * 60 - 90, width: 50, height: 25, fill: "#666666", stroke: null}).addChildTo(group);
            else {
                if (this.newZone) {
                    group.on("pointover", function() {this.setScale(1.1)})
                    .on("pointout", function() {this.setScale(1)})
                    .on("pointstart", function() {
                        this.notesData[this.level][i][this.newZone.lane] = this.newZone.type;
                        editZones.interactive = true;
                        this.newZone.fill = Button.defaults.fill;
                        this.newZone = null;
                        this.notes.reset();
                        this.tripletNotes.reset();
                    }.bind(this)).setInteractive(true);
                }
                for (let j = 0; j < 4; j++) {
                    const key = RectangleShape({x: j * 60 - 90, width: 50, height: this.NOTES_INTERVAL - 5, fill: colorOf(this.notesData[this.level][i][j], this.newZone), stroke: null}).addChildTo(group);
                    self.noteButtons[i][j] = key;
                    if (!this.newZone) key.on("pointstart", function(){ self.toggleNoteAt(i, j); }.bind(self) ).setInteractive(true);
                }
                if (this.notesData[this.level][i].bind) {
                    Label({x: -130, text: "["}).on("pointstart", function() {
                        this.notesData[this.level][i].bind = NOTHING;
                        this.notes.reset();
                        this.tripletNotes.reset();
                    }.bind(this)).setInteractive(true).addChildTo(group).rotation = this.notesData[this.level][i].bind === START ? -90 : 90;
                }
                if (this.notesData[this.level][i].random) {
                    Label({x: -150, text: "{"}).on("pointstart", function() {
                        this.notesData[this.level][i].random = NOTHING;
                        this.notes.reset();
                        this.tripletNotes.reset();
                    }.bind(this)).setInteractive(true).addChildTo(group).rotation = this.notesData[this.level][i].random === START ? -90 : 90;
                }
            }
            return root;
        }.bind(this), Vector2(0, this.s.pitch.y)).addChildTo(this.score);

        this.tripletNotes = InfiniteOf(function(i) {
            if (!this.tripletNotesData[this.level][i]) {
                this.tripletNotesData[this.level][i] = [NOTHING, NOTHING, NOTHING, NOTHING];
                this.tripletNotesData[this.level][i].bind = NOTHING;
                this.tripletNotesData[this.level][i].random = NOTHING;
            }
            if (!this.tripletNoteButtons[i]) {
                this.tripletNoteButtons[i] = [null, null, null, null];
            }
            const root = DisplayElement();
            const group = DisplayElement({width: 225, height: 18, y: -this.NOTES_INTERVAL / 3}).addChildTo(root);
            const self = this;
            if (LANES.some(function (lane) {
                return this.notesData[this.level][Math.floor(i / 3) * 2] && this.notesData[this.level][Math.floor(i / 3) * 2][lane] !== NOTHING || this.notesData[this.level][Math.floor(i / 3) * 2 + 1] && this.notesData[this.level][Math.floor(i / 3) * 2 + 1][lane] !== NOTHING;
            }, this)) for (let j = 0; j < 4; j++) RectangleShape({x: j * 60 - 90, width: 50, height: this.NOTES_INTERVAL / 2, fill: "#666666", stroke: null}).addChildTo(group);
            else {
                if (this.newZone) {
                    group.on("pointover", group.setScale.bind(group, 1.1))
                    .on("pointout", group.setScale.bind(group, 1))
                    .on("pointstart", function() {
                        this.tripletNotesData[this.level][i][this.newZone.lane] = this.newZone.type;
                        editZones.interactive = true;
                        this.newZone.fill = Button.defaults.fill;
                        this.newZone = null;
                        this.notes.reset();
                        this.tripletNotes.reset();
                    }.bind(this)).setInteractive(true);
                }
                for (let j = 0; j < 4; j++) {
                    const key = RectangleShape({x: j * 60 - 90, width: 50, height: this.NOTES_INTERVAL / 2, fill: colorOf(this.tripletNotesData[this.level][i][j], this.newZone), stroke: null}).addChildTo(group);
                    self.tripletNoteButtons[i][j] = key;
                    if (!this.newZone) key.on("pointstart", function(){ self.toggleTripletNoteAt(i, j) }.bind(self) ).setInteractive(true);
                }
                if (this.tripletNotesData[this.level][i].bind) {
                    Label({x: 130, text: "["}).on("pointstart", function() {
                        this.tripletNotesData[this.level][i].bind = NOTHING;
                        this.notes.reset();
                        this.tripletNotes.reset();
                    }.bind(this)).setInteractive(true).addChildTo(group).rotation = this.tripletNotesData[this.level][i].bind === START ? -90 : 90;
                }
                if (this.tripletNotesData[this.level][i].random) {
                    Label({x: 150, text: "{"}).on("pointstart", function() {
                        this.tripletNotesData[this.level][i].random = NOTHING;
                        this.notes.reset();
                        this.tripletNotes.reset();
                    }.bind(this)).setInteractive(true).addChildTo(group).rotation = this.tripletNotesData[this.level][i].random === START ? -90 : 90;
                }
            }
            return root;
        }.bind(this), Vector2(0, this.s.pitch.y / 3 * 2), {x: 120}).hide().addChildTo(this.score);

        this.notesCountLabel = Label({
            text: "0 Notes\n0 Attack Notes\n0.00 Notes Per Second",
            fontSize: 18,
            fontFamily: "Nova Mono",
            align: "left",
            baseline: "top",
            x: 60, y: 680
        }).addChildTo(this);
        this.BUTTONS_X = 860;

        this.noteTypeButton = Button({
            text: "Normal Notes",
            fill: colorOf(NORMAL),
            fontSize: 20,
            x: this.BUTTONS_X, y: 50
        }).on("pointstart", this.changeNoteType.bind(this)).addChildTo(this);
        Button({text: "Triplet", x: this.BUTTONS_X, y: 130}).on("pointstart", this.toggleTripletVisibility.bind(this)).addChildTo(this);

        const editZones = Button({
            text: "Edit Zones",
            fontSize: 20,
            x: this.BUTTONS_X, y: 210
        }).addChildTo(this);
        editZones.addChild(phina.createClass({
            superClass: DisplayElement,
            init: function(options) {
                this.superInit(options);
                this.clipX = this.width;
                editZones.on("pointover", function() {
                    this.tweener.clear().to({clipX: 0}, 500, "easeOutCubic").play();
                }.bind(this)).on("pointout", function() {
                    this.tweener.clear().to({clipX: this.width}, 500, "easeOutCubic").play();
                    this.cancel.tweener.to({y: 39}, 500, "easeOutCubic").play();
                    this.cancel.interactive = false;
                }.bind(this));
                this.buttons = [
                    Button({
                        text: "[",
                        fontSize: 20,
                        cornerRadius: 0,
                        width: 80,
                        x: -40
                    }).addChildTo(this).$safe({lane: "bind", type: START}),
                    Button({
                        text: "]",
                        fontSize: 20,
                        cornerRadius: 0,
                        width: 80,
                        x: 40
                    }).addChildTo(this).$safe({lane: "bind", type: END}),
                ];
                this.cancel = Button({
                    text: "Cancel",
                    fontSize: 12,
                    cornerRadius: 0,
                    height: 14,
                    y: 39,
                    fill: "#c0392b"
                }).addChildTo(this);
                this.cancel.interactive = false;
            },
            update: function() {
                this.visible = this.width - this.clipX > this.parent.cornerRadius;
            },
            onadded: function() {
                const scene = this.getRoot();
                const self = this;
                this.buttons.each(function(button) {
                    button.on("pointstart", function() {
                        self.buttons.each(function(button) {
                            button.fill = Button.defaults.fill;
                        });
                        this.fill = "hsl(200, 70%, 50%)";
                        scene.newZone = this;
                        scene.notes.reset();
                        scene.tripletNotes.reset();
                        editZones.interactive = false;
                        self.cancel.interactive = true;
                        self.cancel.tweener.to({y: 25}, 500, "easeOutCubic").play();
                    });
                });
                this.cancel.on("pointstart", function() {
                    self.buttons.each(function(button) {
                        button.fill = Button.defaults.fill;
                    });
                    scene.newZone = null;
                    scene.notes.reset();
                    scene.tripletNotes.reset();
                    this.interactive = false;
                    editZones.interactive = true;
                    this.tweener.to({y: 39}, 500, "easeOutCubic").play();
                });
            },
            clip: function(canvas) {
                canvas.beginPath().roundRect(this.clipX - this.width / 2, -this.height / 2, this.width - this.clipX, this.height, this.parent.cornerRadius);
            }
        })({width: 160, height: 64}));

        const updateDifficulty = function(level) {
            this.level = level;
            this.fullUpdate();

            if(this.level == "easy") difficultyButton.text = "Easy", difficultyButton.fill = "#15bd94";
            if(this.level == "normal") difficultyButton.text = "Normal", difficultyButton.fill = "#d1a715";
            if(this.level == "hard") difficultyButton.text = "Hard", difficultyButton.fill = "#e33519";
        }.bind(this);

        const difficultyButton = Button({text: "Normal", fill: "#d1a715", x: this.BUTTONS_X, y: 290, stroke: null}).on("pointstart", function() {
            if(this.level == "easy") updateDifficulty("normal");
            else if(this.level == "normal") updateDifficulty("hard");
            else if(this.level == "hard") updateDifficulty("easy");
        }.bind(this)).addChildTo(this);
        shortcut.add("O", function() {
            if(this.level == "easy") updateDifficulty("hard");
            else if(this.level == "normal") updateDifficulty("easy");
            else if(this.level == "hard") updateDifficulty("normal");
        }.bind(this));
        shortcut.add("P", function() {
            if(this.level == "easy") updateDifficulty("normal");
            else if(this.level == "normal") updateDifficulty("hard");
            else if(this.level == "hard") updateDifficulty("easy");
        }.bind(this));

        // Button({text: "Load"}).setPosition(this.BUTTONS_X, 530).on("pointstart", function() {
        //     this.app.pushScene(LoadMenuScene(this));
        // }.bind(this)).addChildTo(this);

        Button({text: "Setting", fill: "grey"}).setPosition(this.BUTTONS_X, 450).on("pointstart", function() {
            this.app.pushScene(MetaSettingScene(this));
        }.bind(this)).addChildTo(this);

        const importFile = function(file) {
            const fileReader = new FileReader();
            fileReader.onload = function(event) {
                this.import(JSON.parse(event.target.result));
                this.id = undefined;
            }.bind(this);
            fileReader.readAsText(file);
        }.bind(this);

        document.getElementById("import").addEventListener("change", function(event) {
            importFile(event.target.files[0]);
        });

        this.on("enter", function(e) {
            e.app.domElement.addEventListener("wheel", function(e) {
                // e.deltaMode は 0なら1が1px、1なら1が1行であることを意味する
                this.score.y = Math.min(Math.max(this.score.y - e.deltaY * (e.deltaMode === 1 ? 35 : 1), 0), -this.notes.pitch.y * this.lengths[this.level].totalBarsCount - this.height);
                this.updateGraphY();
            }.bind(this));
            e.app.domElement.addEventListener("dragover", function(event) {
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
            });
            e.app.domElement.addEventListener("drop", function(event) {
                event.preventDefault();
                importFile(event.dataTransfer.files[0]);
            });
        });

        document.getElementById("export").addEventListener("click", function() {
            const json = this.export();
            console.time("copy");
            const temp = document.createElement("textarea");

            temp.value = json;
            temp.selectionStart = 0;
            temp.selectionEnd = temp.value.length;

            const s = temp.style;
            s.position = "fixed";
            s.left = "-100%";

            document.body.appendChild(temp);
            temp.focus();
            const result = document.execCommand("copy");
            temp.blur();
            document.body.removeChild(temp);
            console.timeEnd("copy");
            if (!result) console.error("export failed!");
        }.bind(this));

        shortcut.add("Up", function() {
            if(this.currentLinePos + this.noteMeasure < this.lengths[this.level].sum.slice(-1)){
                this.currentLinePos += this.noteMeasure;
            }
            this.updateCurrentLine();
        }.bind(this));
        shortcut.add("Down", function() {
            if (this.currentLinePos >= this.noteMeasure) {
                this.currentLinePos -= this.noteMeasure;
            }
            this.updateCurrentLine();
        }.bind(this));
        shortcut.add("Shift+Up", function() {
            if(this.currentLinePos + 16 < this.lengths[this.level].sum.slice(-1)){
                this.currentLinePos += 16;
            }
            this.updateCurrentLine();
        }.bind(this));
        shortcut.add("Shift+Down", function() {
            if (this.currentLinePos >= 16) {
                this.currentLinePos -= 16;
            }else{
                this.currentLinePos = 0;
            }
            this.updateCurrentLine();
        }.bind(this));

        this.noteMeasure = 4;
        this.noteMeasureLabel = Label({
            text: "Selected: 4th Note",
            fontSize: 24,
            fontFamily: "Nova Mono",
            align: "left",
            baseline: "top",
            x: 15, y: 15
        }).addChildTo(this);

        shortcut.add("Left", function() {
            if (this.noteMeasure === 1) this.noteMeasure = 2;
            else if (this.noteMeasure === 2) this.noteMeasure = 4;

            this.currentLinePos = Math.floor(this.currentLinePos / this.noteMeasure) * this.noteMeasure;
            this.currentLine.y = -this.NOTES_INTERVAL / 2 - this.currentLinePos * this.NOTES_INTERVAL;

            this.noteMeasureLabel.text = "Selected: " + ["", "16th Note", "8th Note", "", "4th Note"][this.noteMeasure];
            this.currentLine.width = ["", 260, 330, "", 400][this.noteMeasure];
        }.bind(this));
        shortcut.add("Right", function() {
            if (this.noteMeasure === 4) this.noteMeasure = 2;
            else if (this.noteMeasure === 2) this.noteMeasure = 1;

            this.noteMeasureLabel.text = "Selected: " + ["", "16th Note", "8th Note", "", "4th Note"][this.noteMeasure];
            this.currentLine.width = ["", 260, 330, "", 400][this.noteMeasure];
        }.bind(this));

        this.initSongFileButton();
        this.initShortcutKey();

        this.import(this.json);
    },
    save: function() {
        const saves = JSON.parse(localStorage.getItem("saves") || "[]");
        this.export();
        const save = {changed: Date.now(), json: this.json};
        if (this.id !== undefined) {
            saves[this.id] = save;
        } else {
            this.id = saves.length;
            saves.push(save);
        }
        localStorage.setItem("saves", JSON.stringify(saves));
    },
    update: function() {
        this.screenBottom.y = this.height;
        this.currentPos.height = this.height / 60;

        // const domLeft = appCanvas.getBoundingClientRect().left;
        // const domTop = appCanvas.getBoundingClientRect().top;
        // const canvasWidth = appCanvas.getBoundingClientRect().width;
        // const buttonWidth = 160;
        // const buttonLeft = this.BUTTONS_X / SCREEN_WIDTH * canvasWidth - buttonWidth / 2;
        //
        // this.divDom.style.left = `${domLeft}px`;
        // this.divDom.style.top = `${domTop}px`;
        // this.songFileButton.style.left = `${buttonLeft}px`;
    },
    updateDencityGraph: function() {
        while (this.dencityGraph.children.length > this.notesCountOfBar[this.level].length) this.dencityGraph.children.last.remove();
        while (this.dencityGraph.children.length < this.notesCountOfBar[this.level].length) {
            const group = DisplayElement({y: -this.dencityGraph.children.length * 8}).addChildTo(this.dencityGraph);
            group.normal = RectangleShape({
                height: 6,
                stroke: null
            }).setOrigin(0, 0.5).addChildTo(group);
            group.attack = RectangleShape({
                height: 6,
                fill: "red",
                stroke: null
            }).setOrigin(0, 0.5).addChildTo(group);
        }
        for(let i = 0; i < this.dencityGraph.children.length; i++) {
            this.dencityGraph.children[i].normal.width = this.notesCountOfBar[this.level][i] * this.json.bpm / 90;
            this.dencityGraph.children[i].attack.width = this.attackNotesCountOfBar[this.level][i] * this.json.bpm / 90;
        }
    },
    updateGraphY: function() {
        // 60 = 30 * 16 / 8
        const a = Math.min((this.height - 122) * 60 / (-this.notes.pitch.y * this.lengths[this.level].totalBarsCount - this.height), 1);
        this.currentPos.y = -this.score.y / 60 * a + 2;
        this.dencityGraph.y = this.score.y / 60 * (1 - a) - 9;
    },
    updateBarsCount: function(updategraph) {
        this.extend.y = this.notes.pitch.y * this.lengths[this.level].totalBarsCount + 40;
        this.cut.y = this.extend.y - this.lengths[this.level].diff[this.lengths[this.level].length - 1] * this.notes.pitch.y;
        if (this.score.y > -this.notes.pitch.y * this.lengths[this.level].totalBarsCount) {
            this.notes.sleep();
            this.tripletNotes.sleep();
            this.score.tweener.to({y: -this.notes.pitch.y * this.lengths[this.level].totalBarsCount}, 500, "easeOutQuad").call(function() {
                this.notes.wakeUp();
                this.tripletNotes.wakeUp();
            }.bind(this)).play();
        }
        this.s.reset();
        for (let i = this.notesCountOfBar[this.level].length; i < Math.ceil(this.lengths[this.level].totalBarsCount / 16); i++) {
            this.notesCountOfBar[this.level][i] = 0;
            this.attackNotesCountOfBar[this.level][i] = 0;
        }

        this.updateGraphY();
        this.updateNotesCount();

    },
    updateNotesCount: function() {
        // 4 / 60 = 1 / 15
        this.notesCountLabel.text = this.notesCount[this.level] + " Notes\n" + this.attackNotesCount[this.level] + " Attack Notes\n" + (this.notesCount[this.level] * this.json.bpm / 15 / this.lengths[this.level].totalBarsCount).toFixed(2) + " Notes Per Second";
        this.updateDencityGraph();
    },
    updateNotesInterval: function() {
        this.extend.y = 40 - BARS_COUNT_INITIAL * this.NOTES_INTERVAL * 16;
        this.cut.y = 520 - BARS_COUNT_INITIAL * this.NOTES_INTERVAL * 16;

        const currentLineYInScreen = this.currentLine.y + this.score.y;
        this.currentLine.height = this.NOTES_INTERVAL;
        this.currentLine.y = -this.NOTES_INTERVAL / 2 - this.currentLinePos * this.NOTES_INTERVAL;

        this.score.y = currentLineYInScreen - this.currentLine.y;
        this.score.y = Math.min(Math.max(this.score.y, 0), -this.notes.pitch.y * this.lengths[this.level].totalBarsCount - this.height);
        this.updateCurrentLine();

        this.s.pitch = Vector2(0, -this.NOTES_INTERVAL);
        this.s.reset();
        this.notes.pitch = Vector2(0, this.s.pitch.y);
        this.notes.reset();
        this.tripletNotes.pitch = Vector2(0, this.s.pitch.y / 3 * 2);
        this.tripletNotes.reset();
    },
    updateInformation: function() {
        // 現状は空
    },
    fullUpdate: function() {
        this.updateBarsCount();
        this.notes.reset();
        this.tripletNotes.reset();
    },
    // 内部形式とJSON形式の変換。もはや読めない。
    import: function(score) {
        function dataOf(ch) {
            if (ch === "1" || ch === "2" || ch === "3" || ch === "4") return NORMAL;
            if (ch === "5" || ch === "6" || ch === "7" || ch === "8") return ATTACK;
            if (ch === "a" || ch === "b" || ch === "c" || ch === "d") return LONG_START;
            if (ch === "e" || ch === "f" || ch === "g" || ch === "h") return LONG_END;
            if (ch === "[" || ch === "{") return START;
            if (ch === "]" || ch === "}") return END;
            throw new Error("invaild note!");
        }

        function laneOf(ch) {
            if (ch === "1" || ch === "5" || ch === "a" || ch === "e") return 0;
            if (ch === "2" || ch === "6" || ch === "b" || ch === "f") return 1;
            if (ch === "3" || ch === "7" || ch === "c" || ch === "g") return 2;
            if (ch === "4" || ch === "8" || ch === "d" || ch === "h") return 3;
            if (ch === "[" || ch === "]") return "bind";
            if (ch === "{" || ch === "}") return "random";
            throw new Error("invaild lane!");
        }

        function isVaild(ch) {
            return ch === "1" || ch === "2" || ch === "3" || ch === "4" || ch === "5" || ch === "6" || ch === "7" || ch === "8" || ch === "a" || ch === "b" || ch === "c" || ch === "d" || ch === "e" || ch === "f" || ch === "g" || ch === "h" || ch === "[" || ch === "]" || ch === "{" || ch === "}";
        }

        const increment = function(key, ii, type) {
            if (type === START || type === END) return;
            this.notesCount[key]++;
            if (!this.notesCountOfBar[key][Math.floor(ii / 16)]) this.notesCountOfBar[key][Math.floor(ii / 16)] = 0;
            this.notesCountOfBar[key][Math.floor(ii / 16)]++;
            if (type === ATTACK) {
                this.attackNotesCount[key]++;
                if(!this.attackNotesCountOfBar[key][Math.floor(ii / 16)]) this.attackNotesCountOfBar[key][Math.floor(ii / 16)] = 0;
                this.attackNotesCountOfBar[key][Math.floor(ii / 16)]++;
            }
        }.bind(this);
        console.time("import");
        this.json = score;
        this.json.map.forIn(function(key, value) {
            console.log("importing " + key)
            this.notesData[key] = [];
            this.tripletNotesData[key] = [];
            this.notesCount[key] = 0;
            this.notesCountOfBar[key] = [];
            this.attackNotesCount[key] = 0;
            this.attackNotesCountOfBar[key] = [];
            this.lengths[key].clear();
            var ii = 0, ij = 0, nextTriplet = -1;
            for (var i = 0; i < value.length; i++) {
                value[i] = value[i].split(",");
                for (var j = 0, jj = 0; j < value[i].length; j++) {
                    this.notesData[key][ii] = [NOTHING, NOTHING, NOTHING, NOTHING];
                    this.notesData[key][ii].bind = NOTHING;
                    this.notesData[key][ii].random = NOTHING;
                    if (value[i][j].includes("(") || nextTriplet >= 0) {
                        const nowTriplet = Math.max(nextTriplet, 0);
                        nextTriplet = -1;
                        for (var k = 0;; k++) { // )か小節区切りまでループ
                            var ik = ij / 2 + k;
                            this.tripletNotesData[key][ik] = [NOTHING, NOTHING, NOTHING, NOTHING];
                            this.tripletNotesData[key][ik].bind = NOTHING;
                            this.tripletNotesData[key][ik].random = NOTHING;
                            if(value[i][j] === undefined) {
                                nextTriplet = k % 3;
                                break;
                            }
                            let tripletEnd = false;
                            for(let l = 0; l < value[i][j].length; l++) {
                                const ch = value[i][j].charAt(l);
                                if (ch === ")") tripletEnd = true;
                                else if (ch === "(") tripletEnd = false;
                            }
                            if (tripletEnd && (k + nowTriplet) % 3 === 0) {
                                j--; // 三連符が8分のタイミングで終わる時は通常の8分にする
                                break;
                            } else for(let l = 0; l < value[i][j].length; l++) {
                                const ch = value[i][j].charAt(l);
                                if(isVaild(ch) && this.tripletNotesData[key][ik][laneOf(ch)] === NOTHING) {
                                    const type = dataOf(ch);
                                    increment(key, ii, type);
                                    this.tripletNotesData[key][ik][laneOf(ch)] = type;
                                }
                            }
                            if (tripletEnd) {
                                jj++;
                                ii++;
                                ij += 2;
                                break;
                            }
                            j++;
                            ii += 2 / 3;
                        }
                        jj += k / 3 * 2;
                        ij += k * 2;
                        ii = Math.round(ii);
                    } else {
                        for(let k = 0; k < value[i][j].length; k++) {
                            const ch = value[i][j].charAt(k);
                            if(isVaild(ch) && this.notesData[key][ii][laneOf(ch)] === NOTHING) {
                                const type = dataOf(ch);
                                increment(key, ii, type);
                                this.notesData[key][ii][laneOf(ch)] = type;
                            }
                        }
                        ii++;
                        jj++;
                        ij += 3;
                    }
                }
                this.lengths[key].push(Math.round(jj));
            }
            for (;i < 5; i++) this.lengths[key].push(16);

            this.barsCount[key] = Math.max(i, BARS_COUNT_INITIAL);
            for(let i = 0; i < Math.max(this.notesCountOfBar[key].length, BARS_COUNT_INITIAL); i++) {
                if(!this.notesCountOfBar[key][i]) this.notesCountOfBar[key][i] = 0;
                if(!this.attackNotesCountOfBar[key][i]) this.attackNotesCountOfBar[key][i] = 0;
            }
        }, this);

        console.timeEnd("import");
        this.fullUpdate();
    },
    export: function() {
        function codeOf(data, lane) {
            if (data === NOTHING) return "";
            if (data === NORMAL) return lane + 1;
            if (data === ATTACK) return lane + 5;
            if (data === LONG_START) return ["a", "b", "c", "d"][lane];
            if (data === LONG_END) return ["e", "f", "g", "h"][lane];

            if (data === START) return {bind: "[", random: "{"}[lane];
            if (data === END) return {bind: "]", random: "}"}[lane];
            throw new Error("invaild data: " + data);
        }
        // console.time("export");
        ["easy", "normal", "hard"].each(function(level) {
            this.json.map[level] = [];
            let putrightparenthese = false;
            for (let i = 0; i < this.barsCount[level]; i++) {
                let data = "";
                const o = i === 0 ? 0 : this.lengths[level].sum[i - 1];
                t:
                for (let j = o; j < o + this.lengths[level].diff[i]; j++, data += ",") {
                    if(putrightparenthese) {
                        data += ")";
                        putrightparenthese = false;
                    }
                    if (this.notesData[level][j]) LANES.each(function (lane) {
                        data += codeOf(this.notesData[level][j][lane], lane);
                    }, this);
                    if (j % 2 === 0 && j < o + this.lengths[level].diff[i] - 1) {
                        // 8分刻みで通常のノーツがあるか
                        if (this.notesData[level][j]) if (LANES.some(function (lane) {
                            return this.notesData[level][j][lane] !== NOTHING;
                        }, this)) continue;
                        if (this.notesData[level][j + 1]) if (LANES.some(function (lane) {
                            return this.notesData[level][j + 1][lane] !== NOTHING;
                        }, this)) continue;
                        // なければ3連符を配置
                        data += "("
                        for(let k = 0;; k++) {
                            if (this.tripletNotesData[level][j * 3 / 2 + k]) LANES.each(function (lane) {
                                data += codeOf(this.tripletNotesData[level][j * 3 / 2 + k][lane], lane);
                            }, this);
                            if (k === 2) break;
                            data += ",";
                        }
                        j++;
                        putrightparenthese = true;
                    }
                }
                data = data.slice(0, -1); // 最後に余計な,が付くので消す
                if (data.endsWith("(,,")) { // 上の仕組みは次の小節始めで閉じようとするので
                    putrightparenthese = false;
                    data = data.replace(/\(,,$/, ",");
                }
                // 上の仕組みによって空いているところは(,,,)で埋まるが無駄なので,,に置き換える
                // また )( のような形ができることもあるが無駄なので消す
                this.json.map[level].push(data.replace(/\(,,,\)/g, ",,").replace(/\)\(/g, ""));
            }
        }, this);

        const json = JSON.stringify(this.json, null, " ");

        // console.timeEnd("export");

        return json;
    },

    initShortcutKey: function() {
            shortcut.add("T", function() {
                this.toggleTripletVisibility.bind(this)();
            }.bind(this));

            shortcut.add("R", function() {
                this.changeNoteType();
            }.bind(this));

            this.music = Music();
            shortcut.add("L", function() {
                if(!this.music.isSet()){
                    alert("音声を再生するには、Load Songボタンから音声ファイルを選択してください。");
                    return;
                }
                if(this.music.isPlaying()){
                    this.music.stop();
                }else{
                    this.music.playAt(this.json.startTime + 60 * 1000 / this.json.bpm / 4 * this.currentLinePos);
                }
            }.bind(this));

            shortcut.add("1", function() {
                this.toggleNoteAt(this.currentLinePos, 0);
            }.bind(this));
            shortcut.add("2", function() {
                this.toggleNoteAt(this.currentLinePos, 1);
            }.bind(this));
            shortcut.add("3", function() {
                this.toggleNoteAt(this.currentLinePos, 2);
            }.bind(this));
            shortcut.add("4", function() {
                this.toggleNoteAt(this.currentLinePos, 3);
            }.bind(this));

            setInterval(function() {
                const currentLineYInScreen = this.currentLine.y + this.score.y;
            }.bind(this), 300);
    },
    initSongFileButton: function() {
        const fileButton = document.createElement("input");
        fileButton.setAttribute("type", "file");
        fileButton.setAttribute("accept", ".mp3,.m4a,.aac,.wav,.flac");

        const visibleButton = Button({
            text: "Load Song",
            fontSize: 22,
            fill: "#f05d71",
            stroke: "#d64b5e",
            x: this.BUTTONS_X, y: 210 + 80 * 2
        }).on("pointstart", function() {
            fileButton.addEventListener('click', function(e) {
                e.stopPropagation();
            });
            fileButton.click();
        }.bind(this)).addChildTo(this);

        fileButton.addEventListener("change", function(e) {
            if(fileButton.files.length == 0){
                return;
            }
            const file = fileButton.files[0];
            if(!file.type.match('audio.*')){
                alert("音声ファイルを選択してください。");
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                this.music.set(reader.result);
                visibleButton.text = "Loaded!";
            };
            reader.readAsDataURL(file);
        }.bind(this));
    },
    toggleTripletVisibility: function() {
        this.tripletNotes.visible = !this.tripletNotes.visible;
        this.notes.x = this.tripletNotes.visible ? -120 : 0;

        this.currentLine.x = this.tripletNotes.visible ? -120 : 0;
    },
    toggleNoteAt: function(i, lane) {
        if (this.notesData[this.level][i][lane]) {
            this.notesCount[this.level]--;
            this.notesCountOfBar[this.level][Math.floor(i / 16)]--;
            if (this.notesData[this.level][i][lane] === ATTACK) {
                this.attackNotesCount[this.level]--;
                this.attackNotesCountOfBar[this.level][Math.floor(i / 16)]--;
            }
            this.notesData[this.level][i][lane] = NOTHING;
        } else {
            this.notesCount[this.level]++;
            this.notesCountOfBar[this.level][Math.floor(i / 16)]++;
            if (this.notetype === ATTACK) {
                this.attackNotesCount[this.level]++;
                this.attackNotesCountOfBar[this.level][Math.floor(i / 16)]++;
            }
            this.notesData[this.level][i][lane] = this.notetype;
        }
        this.noteButtons[i][lane].fill = colorOf(this.notesData[this.level][i][lane]);
        this.updateNotesCount();
        this.save();
        this.tripletNotes.reset();
    },
    toggleTripletNoteAt: function(i, lane) {
            if (this.tripletNotesData[this.level][i][lane]) {
                this.notesCount[this.level]--;
                this.notesCountOfBar[this.level][Math.floor(i / 24)]--;
                if (this.tripletNotesData[this.level][i][lane] === ATTACK) {
                    this.attackNotesCount[this.level]--;
                    this.attackNotesCountOfBar[this.level][Math.floor(i / 24)]--;
                }
                this.tripletNotesData[this.level][i][lane] = NOTHING;
            } else {
                this.notesCount[this.level]++;
                this.notesCountOfBar[this.level][Math.floor(i / 24)]++;
                if (this.notetype === ATTACK) {
                    this.attackNotesCountOfBar[this.level][Math.floor(i / 24)]++;
                    this.attackNotesCount[this.level]++;
                }
                this.tripletNotesData[this.level][i][lane] = this.notetype;
            }
            this.tripletNoteButtons[i][lane].fill = colorOf(this.tripletNotesData[this.level][i][lane]);
            this.updateNotesCount();
            this.save();
            this.notes.reset();
    },
    changeNoteType: function() {
        if (++this.notetype > LONG_END) this.notetype = NORMAL;
        this.noteTypeButton.text = ["Normal Notes", "Attack Notes", "Long-Start", "Long-End"][this.notetype - 1];
        this.noteTypeButton.fill = colorOf(this.notetype);

        this.currentLine.fill = colorOf(this.notetype);
    },
    updateCurrentLine: function() {
        this.currentLine.y = -this.NOTES_INTERVAL / 2 - this.currentLinePos * this.NOTES_INTERVAL;

        if(this.score.y < -this.currentLine.y - this.height + this.NOTES_INTERVAL / 2){
            this.score.y = -this.currentLine.y - this.height + this.NOTES_INTERVAL / 2;
        }else if(this.score.y > -this.currentLine.y - this.NOTES_INTERVAL / 2){
            this.score.y = -this.currentLine.y - this.NOTES_INTERVAL / 2;
        }
    }
});

// 各小節の長さを管理するクラス
phina.define("Lengths", {
    init: function() {
        this.diff = [];
        this.sum = [];
        for(let i = 0; i < BARS_COUNT_INITIAL; i++){
            this.diff.push(16);
            this.sum.push(16 * i + 16);
        }
    },
    push: function(x) {
        this.diff.push(x);
        this.sum.push(this.length > 1 ? this.sum[this.length - 2] + x : x);
    },
    set: function(i, x) {
        this.diff[i] = x;
        this.sum[i] = i > 0 ? this.sum[i - 1] + x : x;
        for (i++; i < this.length; i++) this.sum[i] = this.sum[i - 1] + this.diff[i];
    },
    cut: function() {
        this.diff.pop();
        this.sum.pop();
    },
    clear: function() {
        this.diff = [];
        this.sum = [];
    },
    _accessor: {
        length: {
            get: function() {return this.diff.length;},
        },
        totalBarsCount: {
            get: function() {return this.sum[this.length - 1];},
        }
    }
});

// 上部のメッセージ
phina.define("Message", {
    superClass: "phina.display.Shape",
    init: function(save) {
        this.superInit();
        this.width = 880;
        this.height = 88;
        this.interactive = true;
        this.origin.set(0, 0);
        this.backgroundColor = "#888c";

        Label({x: 10, y: 20, align: "left", fontSize: 16, text: (save.json.title || "タイトルなし") + (save.json.artist !== "" ? " / " : "") + save.json.artist}).addChildTo(this);
        Label({x: 10, y: 40, align: "left", fontSize: 16, text: "BPM: " + save.json.bpm}).addChildTo(this);
        Label({x: 10, y: 60, align: "left", fontSize: 16, text: "Level: " + save.json.level.easy + "/" + save.json.level.normal + "/" + save.json.level.hard}).addChildTo(this);
        Label({x: 10, y: 80, align: "left", fontSize: 16, text: "Last changed: " + new Date(save.changed).toLocaleString("japanese")}).addChildTo(this);

        const deleteButton = Button({x: 840, y: 80, fill: "#422", text: "Delete", width: 100, height: 40, fontSize: 16}).addChildTo(this);
        deleteButton.on("pointstart", function() {
            this.childclicked = true;
            this.flare("delete");
            this.remove();
        }.bind(this));
    }
});

let appCanvas;

phina.main(function() {
    const app = GameApp({
        width: SCREEN_WIDTH,
        height: innerHeight,
        // startLabel: "main",
        fps: 60,
        fit: false
    });

    app.domElement.style["display"] = "block";
    app.domElement.style["margin-left"] = "auto";
    app.domElement.style["margin-right"] = "auto";

    appCanvas = app.canvas.canvas;

    const fitFunc = function() {
        app.height = innerHeight;
        app.canvas.setSize(app.canvas.width, app.height);
        app.gridY.width = app.height;
        app.mouse.height = app.height;
        app.touch.height = app.height;
        app.touchList.height = app.height;
        DisplayScene.defaults.height = app.height;
        app._scenes.each(function(scene) {
            scene.height = app.height;
            if (scene.gridY) scene.gridY.width = app.height;
            if (scene.canvas) {
                scene.canvas.setSize(scene.canvas.width, app.height);
            }
        });
    };

    fitFunc();

    addEventListener('resize', fitFunc);

    app.run();
});
