phina.define("KeyWatcher", {
    init: function() {},
    set: function(eventName, keyCode, func) {
        window.addEventListener(eventName, function(e){
            if(e.keyCode == keyCode){
                func();
            }
        });
    }
});
