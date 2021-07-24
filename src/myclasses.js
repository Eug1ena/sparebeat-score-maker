// 渡された関数が生成する要素を一定間隔ごとに配置し、スクロールに反応して常に画面内の要素だけが読み込まれた状態を保つグループ。
// 子要素の状態は外部に保存しなければならない。
// 今になって見ると内部で保存してくれるようになってた方がいいのかと思う。
phina.define("InfiniteOf", {
    superClass: "phina.display.DisplayElement",
    init: function(source, pitch, options) {
        this.superInit(options);
        this.source = source;
        this.pitch = pitch;
        this.reset();
    },
    draw: function() {
        const scene = this.getRoot();
        const globalpos = this.globalPosition;
        const backrate = -Math.floor(Math.min((globalpos.x - (this.pitch.x < 0 ? scene.width : 0)) / this.pitch.x, (globalpos.y - (this.pitch.y < 0 ? scene.height : 0)) / this.pitch.y));
        const base = this.pitch.clone().mul(backrate + 1);
        for(var pos = this.pitch.clone().mul(backrate - 1), i = -1; pos.x - base.x < scene.width && pos.x - base.x > -scene.width && pos.y - base.y < scene.height && pos.y - base.y > -scene.height;
        pos.add(this.pitch), i++) {
            if (i + backrate >= this.nodemin && i + backrate < this.nodemax) continue;
            var node = this.source(i + backrate).addChildTo(this);
            node.position = pos.clone();
            node._i = i + backrate;

            scene.app.updater.update(node);
        }
        this.nodemin = backrate - 1;
        this.nodemax = i + backrate;
        this.children.each(function(child) {
            (child._i < this.nodemin || child._i > this.nodemax) && child.has("removed") && child.flare("removed");
        }, this);
        this.children = this.children.filter(function(child) {
            return child._i >= this.nodemin && child._i <= this.nodemax;
        }, this);
    },
    /*
    * 外部からsource関数/source関数が読み取る変数が変更された際、
    * これを実行しないと古い返り値が残って、表示が更新されない。
    */
    reset: function() {
        this.nodemin = Infinity;
        this.nodemax = -Infinity;
        this.children.each(function(child) {
            child.has("removed") && child.flare("removed");
        });
        this.children = [];
    }
});

// 子要素を一定間隔あけて自動配置するグループ要素
phina.define("List", {
    superClass: "phina.display.DisplayElement",
    renderChildBySelf: true,
    init: function(vertical, padding, options) {
        this.superInit(options);
        this.vertical = vertical;
        this.padding = padding;
    },
    draw: function(canvas) {
        var renderer = phina.display.CanvasRenderer(canvas);
        // Rendererのコピペ
        var length = 0;
        this.children.each(function(obj) {
            if (obj.visible === false && !obj.interactive) return;

            obj._calcWorldMatrix && obj._calcWorldMatrix();

            if (obj.visible === false) return;

            obj._calcWorldAlpha && obj._calcWorldAlpha();

            var context = canvas.context;

            context.globalAlpha = obj._worldAlpha;
            context.globalCompositeOperation = obj.blendMode;

            length += (this.vertical ? obj.height * obj.scaleY * obj.originY : obj.width * obj.scaleX * obj.originX);

            if (obj._worldMatrix) {
                // 行列をセット
                var m = obj._worldMatrix;
                if (this.vertical) {
                    m.m12 = this._worldMatrix.m12 + length;
                } else {
                    m.m02 = this._worldMatrix.m02 + length;
                }
                canvas.setTransform( m.m00, m.m10, m.m01, m.m11, m.m02, m.m12);
            }

            if (obj.clip) {

                context.save();

                obj.clip(canvas);
                context.clip();

                if (obj.draw) obj.draw(canvas);

                // 子供たちも実行
                if (obj.renderChildBySelf === false && obj.children.length > 0) {
                    var tempChildren = obj.children.slice();
                    for (var i=0,len=tempChildren.length; i<len; ++i) {
                        renderer.renderObject(tempChildren[i]);
                    }
                }

                context.restore();
            }
            else {
                if (obj.draw) obj.draw(canvas);

                // 子供たちも実行
                if (obj.renderChildBySelf === false && obj.children.length > 0) {
                    var tempChildren = obj.children.slice();
                    for (var i=0,len=tempChildren.length; i<len; ++i) {
                        renderer.renderObject(tempChildren[i]);
                    }
                }

            }
            length += (this.vertical ? obj.height * obj.scaleY * (1 - obj.originY) : obj.width * obj.scaleX * (1 - obj.originX)) + this.padding;
        }, this);
    }
});

// 親子関係のルートから順番に格納された配列
phina.app.Element.prototype.getter("sequence", function() {
    var sequence = [];
    for(var n = this; n;) {
        sequence.unshift(n);
        n = n.parent;
    }
    return sequence;
});

// 要素の絶対座標
phina.app.Object2D.prototype.getter("globalPosition", function() {
    this.sequence.each(function(val) {val._calcWorldMatrix && val._calcWorldMatrix()});
    // this._worldMatrix.clone().multiplyVector2(Vector2(0, 0))
    return phina.geom.Vector2(this._worldMatrix.m02, this._worldMatrix.m12);
});

phina.define("Music", {
    init: function() {
        this.element = document.createElement("audio");

        console.log(this.element);
    },
    set: function(address) {
        this.stop();
        this.element.src = address;

    },
    play: function(time) {
        this.element.play();
    },
    // 時間はミリ秒で指定
    playAt: function(time) {
        this.element.currentTime = time / 1000;
        this.element.play();
    },
    stop: function() {
        this.element.pause();
        this.element.currentTime = 0;
    },
    isPlaying: function() {
        return !this.element.paused;
    },
    isSet: function() {
        return !!this.element.src;
    }

});
