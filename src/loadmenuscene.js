phina.define('LoadMenuScene', {
  superClass: 'phina.display.DisplayScene',
  init: function(main) {
    this.superInit();
    this.backgroundColor = "#4444";
    var saves = JSON.parse(localStorage.getItem('saves') || "[]");
    saves.sort(function(a, b) {return a.changed - b.changed;});
    var group = List(true, 25, {x: 35, y: 25}).addChildTo(this);
    saves.each(function(save, index) {
      SaveData(save).addChildTo(group).on('pointstart', function() {
        if (this.childclicked) this.childclicked = false;
        else {
          main.import(save.json);
          main.id = index;
        }
      }).on('delete', function() {
        this.childclicked = true;
        saves.splice(index, 1);
        localStorage.setItem('saves', JSON.stringify(saves));
        if (main.id === index) main.id = undefined;
        else if (main.id > index) main.id--;
      }.bind(this));
    }, this);
    if (saves.length === 0) {
      Label({x: SCREEN_CENTER_X, y: SCREEN_CENTER_Y, text: "データがありません", stroke: "#aaa", fill: "#222"}).addChildTo(this)
    }
    this.on("enter", function(e) {
      e.app.domElement.addEventListener('wheel', function(e) {
        group.y = Math.min(Math.max(group.y - e.deltaY * (e.deltaMode === 1 ? 35 : 1), 600 - group.children.reduce(function(h, ch) {return h + ch.height + group.padding}, 0)), group.padding);
      });
    });
  },
  onpointstart: function() {
    if (this.childclicked) this.childclicked = false;
    else this.exit();
  }
});

phina.define('SaveData', {
  superClass: 'phina.display.Shape',
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

    var deleteButton = Button({x: 840, y: 80, fill: "#422", text: "Delete", width: 100, height: 40, fontSize: 16}).addChildTo(this);
    deleteButton.on('pointstart', function() {
      this.childclicked = true;
      this.flare('delete');
      this.remove();
    }.bind(this));
  }
});
