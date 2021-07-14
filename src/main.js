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
phina.define('MainScene', {
    superClass: 'phina.display.DisplayScene',
    init: function() {
        this.superInit();
        this.notetype = NORMAL;
        this.level = "normal";
        this.json = {
            title: "",
            artist: "",
            bpm: 120,
            startTime: 80,
            level: {
                easy: 4,
                normal: 7,
                hard: 9
            },
            map: {}
        };

        // 以下lengthsまで各難易度ごとのデータ
        this.barsCount = { easy: 5, normal: 5, hard: 5}; // 小節数

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
        this.dencitygraph = DisplayElement({y: -9}).addChildTo(this.screenBottom);
        this.dencitygraph.alpha = 0.3;
        this.limitline = PathShape({x: 8 + 240 / 9, strokeWidth: 2, paths: [Vector2(0, 0), Vector2(0, this.height)]}).addChildTo(this);
        Label({x: 68, y: -40, fontSize: 12, text: "10notes/s"}).addChildTo(this.screenBottom);
        this.notesCountOfBar.forIn(function(k, v) {v.fill(0, 0, 5)});
        this.attackNotesCountOfBar.forIn(function(k, v) {v.fill(0, 0, 5)});
        this.currentPos = RectangleShape({
            width: 100,
            height: 10,
            x: 48,
            y: 2,
            fill: "gray",
            stroke: null
        }).addChildTo(this.screenBottom).setOrigin(0.5, 1);
        this.currentPos.alpha = 0.3;
        this.extend = Button({x: -320, y: -2360, text: "+", width: 48, height: 48}).on("pointstart", function() {
            this.barsCount[this.level]++;
            if (this.lengths[this.level].length < this.barsCount[this.level]) this.lengths[this.level].push(16);
            this.updateTime();
            this.save();
        }.bind(this)).addChildTo(this.score);
        this.cut = Button({x: -320, y: -1880, text: "-", width: 48, height: 48}).on("pointstart", function() {
            this.barsCount[this.level]--;
            this.lengths[this.level].cut();
            this.updateTime();
            this.save();
        }.bind(this)).addChildTo(this.score);
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
                    if (this.lengths[this.level].diff[j] % 4 === 0 && (i - (j === 0 ? 0 : this.lengths[this.level].sum[j - 1])) % 4 === 0) return PathShape({paths: [Vector2(-1000, 0), Vector2(1000, 0)], y: -1, strokeWidth: 1, stroke: '#cccccc'});
                    return Element();
                }
            }
            return Element();
        }.bind(this), Vector2(0, -30)).addChildTo(this.score);
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
            if (this.lengths[this.level].sum.includes(i + 1)) {
                Button({x: -140, y: -8, text: "+", width: 36, height: 36}).on("pointstart", function() {
                    const index = this.lengths[this.level].sum.indexOf(i + 1);
                    this.lengths[this.level].set(index, this.lengths[this.level].diff[index] + 1);
                    this.notes.reset();
                    this.updateTime();
                    this.save();
                }.bind(this)).addChildTo(root);
            }
            if (this.lengths[this.level].sum.includes(i + 3)) {
                Button({x: -140, y: -24, text: "-", width: 36, height: 36}).on("pointstart", function() {
                    const index = this.lengths[this.level].sum.indexOf(i + 3);
                    this.lengths[this.level].set(index, this.lengths[this.level].diff[index] - 1);
                    this.notes.reset();
                    this.updateTime();
                    this.save();
                }.bind(this)).addChildTo(root);
            }
            const group = DisplayElement({width: 225, height: 28, y: -15}).addChildTo(root);
            const self = this;
            if(LANES.some(function (lane) {
                return this.tripletNotesData[this.level][Math.floor(i / 2) * 3] && this.tripletNotesData[this.level][Math.floor(i / 2) * 3][lane] !== NOTHING || this.tripletNotesData[this.level][Math.floor(i / 2) * 3 + 1] && this.tripletNotesData[this.level][Math.floor(i / 2) * 3 + 1][lane] !== NOTHING || this.tripletNotesData[this.level][Math.floor(i / 2) * 3 + 2] && this.tripletNotesData[this.level][Math.floor(i / 2) * 3 + 2][lane] !== NOTHING;
            }, this)) for (let j = 0; j < 4; j++) RectangleShape({x: j * 60 - 90, width: 50, height: 25, fill: "#666666", stroke: null}).addChildTo(group);
            else {
                if (this.newZone) {
                    group.on('pointover', function() {this.setScale(1.1)})
                    .on('pointout', function() {this.setScale(1)})
                    .on('pointstart', function() {
                        this.notesData[this.level][i][this.newZone.lane] = this.newZone.type;
                        editZones.interactive = true;
                        this.newZone.fill = Button.defaults.fill;
                        this.newZone = null;
                        this.notes.reset();
                        this.tripletNotes.reset();
                    }.bind(this)).setInteractive(true);
                }
                for (let j = 0; j < 4; j++) {
                    const key = RectangleShape({x: j * 60 - 90, width: 50, height: 25, fill: colorOf(this.notesData[this.level][i][j], this.newZone), stroke: null}).addChildTo(group);
                    self.noteButtons[i][j] = key;
                    if (!this.newZone) key.on("pointstart", function(){ self.toggleNoteAt(i, j); }.bind(self) ).setInteractive(true);
                }
                if (this.notesData[this.level][i].bind) {
                    Label({x: -130, text: "["}).on('pointstart', function() {
                        this.notesData[this.level][i].bind = NOTHING;
                        this.notes.reset();
                        this.tripletNotes.reset();
                    }.bind(this)).setInteractive(true).addChildTo(group).rotation = this.notesData[this.level][i].bind === START ? -90 : 90;
                }
                if (this.notesData[this.level][i].random) {
                    Label({x: -150, text: "{"}).on('pointstart', function() {
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
            const group = DisplayElement({width: 225, height: 18, y: -10}).addChildTo(root);
            const self = this;
            if (LANES.some(function (lane) {
                return this.notesData[this.level][Math.floor(i / 3) * 2] && this.notesData[this.level][Math.floor(i / 3) * 2][lane] !== NOTHING || this.notesData[this.level][Math.floor(i / 3) * 2 + 1] && this.notesData[this.level][Math.floor(i / 3) * 2 + 1][lane] !== NOTHING;
            }, this)) for (let j = 0; j < 4; j++) RectangleShape({x: j * 60 - 90, width: 50, height: 15, fill: "#666666", stroke: null}).addChildTo(group);
            else {
                if (this.newZone) {
                    group.on('pointover', group.setScale.bind(group, 1.1))
                    .on('pointout', group.setScale.bind(group, 1))
                    .on('pointstart', function() {
                        this.tripletNotesData[this.level][i][this.newZone.lane] = this.newZone.type;
                        editZones.interactive = true;
                        this.newZone.fill = Button.defaults.fill;
                        this.newZone = null;
                        this.notes.reset();
                        this.tripletNotes.reset();
                    }.bind(this)).setInteractive(true);
                }
                for (let j = 0; j < 4; j++) {
                    const key = RectangleShape({x: j * 60 - 90, width: 50, height: 15, fill: colorOf(this.tripletNotesData[this.level][i][j], this.newZone), stroke: null}).addChildTo(group);
                    self.tripletNoteButtons[i][j] = key;
                    if (!this.newZone) key.on("pointstart", function(){ self.toggleTripletNoteAt(i, j) }.bind(self) ).setInteractive(true);
                }
                if (this.tripletNotesData[this.level][i].bind) {
                    Label({x: 130, text: "["}).on('pointstart', function() {
                        this.tripletNotesData[this.level][i].bind = NOTHING;
                        this.notes.reset();
                        this.tripletNotes.reset();
                    }.bind(this)).setInteractive(true).addChildTo(group).rotation = this.tripletNotesData[this.level][i].bind === START ? -90 : 90;
                }
                if (this.tripletNotesData[this.level][i].random) {
                    Label({x: 150, text: "{"}).on('pointstart', function() {
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
            fontSize: 22,
            fontFamily: "Nova Mono",
            align: "left",
            baseline: "top",
            x: 10, y: 35
        }).addChildTo(this);
        const BUTTONS_X = 860;
        const notetype = Button({
            text: "Normal Notes",
            fill: colorOf(NORMAL),
            fontSize: 20,
            x: BUTTONS_X, y: 50
        }).on("pointstart", function() {
            if (++this.notetype > LONG_END) this.notetype = NORMAL;
            notetype.text = ["Normal Notes", "Attack Notes", "Long-Start", "Long-end"][this.notetype - 1];
            notetype.fill = colorOf(this.notetype);
        }.bind(this)).addChildTo(this);
        Button({text: "Triplet", x: BUTTONS_X, y: 130}).on("pointstart", this.toggleTripletVisibility.bind(this)).addChildTo(this);

        const editZones = Button({
            text: "Edit Zones",
            fontSize: 20,
            x: BUTTONS_X, y: 210
        }).addChildTo(this);
        editZones.addChild(phina.createClass({
            superClass: DisplayElement,
            init: function(options) {
                this.superInit(options);
                this.clipX = this.width;
                editZones.on('pointover', function() {
                    this.tweener.clear().to({clipX: 0}, 500, "easeOutCubic").play();
                }.bind(this)).on('pointout', function() {
                    this.tweener.clear().to({clipX: this.width}, 500, "easeOutCubic").play();
                    this.cancel.tweener.to({y: 39}, 500, "easeOutCubic").play();
                    this.cancel.interactive = false;
                }.bind(this));
                this.buttons = [
                    Button({
                        text: "[",
                        fontSize: 20,
                        cornerRadius: 0,
                        width: 40,
                        x: -60
                    }).addChildTo(this).$safe({lane: "bind", type: START}),
                    Button({
                        text: "{",
                        fontSize: 20,
                        cornerRadius: 0,
                        width: 40,
                        x: -20
                    }).addChildTo(this).$safe({lane: "random", type: START}),
                    Button({
                        text: "]",
                        fontSize: 20,
                        cornerRadius: 0,
                        width: 40,
                        x: 20
                    }).addChildTo(this).$safe({lane: "bind", type: END}),
                    Button({
                        text: "}",
                        fontSize: 20,
                        cornerRadius: 0,
                        width: 40,
                        x: 60
                    }).addChildTo(this).$safe({lane: "random", type: END})
                ];
                this.cancel = Button({
                    text: "Cancel",
                    fontSize: 12,
                    cornerRadius: 0,
                    height: 14,
                    y: 39,
                    fill: '#c0392b'
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
                    button.on('pointstart', function() {
                        self.buttons.each(function(button) {
                            button.fill = Button.defaults.fill;
                        });
                        this.fill = 'hsl(200, 70%, 50%)';
                        scene.newZone = this;
                        scene.notes.reset();
                        scene.tripletNotes.reset();
                        editZones.interactive = false;
                        self.cancel.interactive = true;
                        self.cancel.tweener.to({y: 25}, 500, "easeOutCubic").play();
                    });
                });
                this.cancel.on('pointstart', function() {
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
            easyButton.fill = "#1abc9c";
            normalButton.fill = "#f1c40f";
            hardButton.fill = "#c0392b";
        }.bind(this);

        const easyButton = Button({text: "Easy", fill: "#1abc9c"}).setPosition(BUTTONS_X, 290).on("pointstart", function() {
            updateDifficulty("easy");
            this.fill = "#18997a";
        }).addChildTo(this);
        const normalButton = Button({text: "Normal", fill: "#cea20a"}).setPosition(BUTTONS_X, 370).on("pointstart", function() {
            updateDifficulty("normal");
            this.fill = "#cea20a";
        }).addChildTo(this)
        const hardButton = Button({text: "Hard", fill: "#c0392b"}).setPosition(BUTTONS_X, 450).on("pointstart", function() {
            updateDifficulty("hard");
            this.fill = "#a43220";
        }).addChildTo(this);

        Button({text: "Load"}).setPosition(BUTTONS_X, 530).on("pointstart", function() {
            this.app.pushScene(LoadMenuScene(this));
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
            e.app.domElement.addEventListener('wheel', function(e) {
                // e.deltaMode は 0なら1が1px、1なら1が1行であることを意味する
                this.score.y = Math.min(Math.max(this.score.y - e.deltaY * (e.deltaMode === 1 ? 35 : 1), 0), -this.notes.pitch.y * this.lengths[this.level].totaltime - this.height);
                this.updateGraphY();
            }.bind(this));
            e.app.domElement.addEventListener("dragover", function(event) {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'copy';
            });
            e.app.domElement.addEventListener("drop", function(event) {
                event.preventDefault();
                importFile(event.dataTransfer.files[0]);
            });
        });

        document.getElementById("export").addEventListener("click", function() {
            const json = this.export();
            console.time("copy");
            const temp = document.createElement('textarea');

            temp.value = json;
            temp.selectionStart = 0;
            temp.selectionEnd = temp.value.length;

            const s = temp.style;
            s.position = 'fixed';
            s.left = '-100%';

            document.body.appendChild(temp);
            temp.focus();
            const result = document.execCommand('copy');
            temp.blur();
            document.body.removeChild(temp);
            console.timeEnd("copy");
            if (!result) console.error("export failed!");
        }.bind(this));

        this.initShortcutKey();
    },
    save: function() {
        const saves = JSON.parse(localStorage.getItem('saves') || "[]");
        this.export();
        const save = {changed: Date.now(), json: this.json};
        if (this.id !== undefined) {
            saves[this.id] = save;
        } else {
            this.id = saves.length;
            saves.push(save);
        }
        localStorage.setItem('saves', JSON.stringify(saves));
    },
    update: function() {
        this.screenBottom.y = this.height;
        this.currentPos.height = this.height / 60;
    },
    updateDencityGraph: function() {
        while (this.dencitygraph.children.length > this.notesCountOfBar[this.level].length) this.dencitygraph.children.last.remove();
        while (this.dencitygraph.children.length < this.notesCountOfBar[this.level].length) {
            const group = DisplayElement({y: -this.dencitygraph.children.length * 8}).addChildTo(this.dencitygraph);
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
        for(let i = 0; i < this.dencitygraph.children.length; i++) {
            this.dencitygraph.children[i].normal.width = this.notesCountOfBar[this.level][i] * this.json.bpm / 90;
            this.dencitygraph.children[i].attack.width = this.attackNotesCountOfBar[this.level][i] * this.json.bpm / 90;
        }
    },
    updateGraphY: function() {
        // 60 = 30 * 16 / 8
        const a = Math.min((this.height - 122) * 60 / (-this.notes.pitch.y * this.lengths[this.level].totaltime - this.height), 1);
        this.currentPos.y = -this.score.y / 60 * a + 2;
        this.dencitygraph.y = this.score.y / 60 * (1 - a) - 9;
    },
    updateTime: function(updategraph) {
        this.extend.y = this.notes.pitch.y * this.lengths[this.level].totaltime + 40;
        this.cut.y = this.extend.y - this.lengths[this.level].diff[this.lengths[this.level].length - 1] * this.notes.pitch.y;
        if (this.score.y > -this.notes.pitch.y * this.lengths[this.level].totaltime) {
            this.notes.sleep();
            this.tripletNotes.sleep();
            this.score.tweener.to({y: -this.notes.pitch.y * this.lengths[this.level].totaltime}, 500, "easeOutQuad").call(function() {
                this.notes.wakeUp();
                this.tripletNotes.wakeUp();
            }.bind(this)).play();
        }
        this.s.reset();
        for (let i = this.notesCountOfBar[this.level].length; i < Math.ceil(this.lengths[this.level].totaltime / 16); i++) {
            this.notesCountOfBar[this.level][i] = 0;
            this.attackNotesCountOfBar[this.level][i] = 0;
        }

        this.updateGraphY();
        this.updateNotesCount();

    },
    updateNotesCount: function() {
        // 4 / 60 = 1 / 15
        this.notesCountLabel.text = this.notesCount[this.level] + " Notes\n" + this.attackNotesCount[this.level] + " Attack Notes\n" + (this.notesCount[this.level] * this.json.bpm / 15 / this.lengths[this.level].totaltime).toFixed(2) + " Notes Per Second";
        this.updateDencityGraph();
    },
    fullUpdate: function() {
        this.updateTime();
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
            this.barsCount[key] = Math.max(i, 5);
            for(let i = 0; i < Math.max(this.notesCountOfBar[key].length, 5); i++) {
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
        console.time("export");
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

        console.timeEnd("export");

        return json;
    },
    initShortcutKey: function() {
        shortcut.add("T", function() {
            this.toggleTripletVisibility.bind(this)();
        }.bind(this));

        // setInterval(function(){
        //     console.log(this.notesData);
        //     console.log(this.newZone);
        // }.bind(this), 1000);
    },
    toggleTripletVisibility: function() {
        this.tripletNotes.visible = !this.tripletNotes.visible;
        this.notes.x = this.tripletNotes.visible ? -120 : 0;
    },
    toggleNoteAt: function(i, lane) {
        console.log(this.level);
        console.log(i + " " + lane);
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
                if (self.tripletNotesData[this.level][i][lane] === ATTACK) {
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
            console.log(i, lane);
            this.tripletNoteButtons[i][lane].fill = colorOf(this.tripletNotesData[this.level][i][lane]);
            this.updateNotesCount();
            this.save();
            this.notes.reset();
    }
});

// 各小節の長さを管理するクラス
phina.define("Lengths", {
    init: function() {
        this.diff = [16, 16, 16, 16, 16];
        this.sum = [16, 32, 48, 64, 80];
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
        totaltime: {
            get: function() {return this.sum[this.length - 1];},
        }
    }
});

phina.main(function() {
    const app = GameApp({
        width: SCREEN_WIDTH,
        height: innerHeight,
        startLabel: "main",
        fps: 60,
        fit: false
    });

    app.domElement.style["display"] = "block";
    app.domElement.style["margin-left"] = "auto";
    app.domElement.style["margin-right"] = "auto";

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
