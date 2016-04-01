var Class = require("easejs").Class
var WorldRenderer = require("./world-renderer")
//var TimelineFetcher = require("../networking/timeline-fetcher").new()
//var WorldStateFetcher = require("../networking/world-state-fetcher").new()

/*
GraphicsEngineController: Holds the state of the camera, listens for input events
and controlls the render engine accordingly. This class also keeps track of
the time stream that the client's simulation is currently in and applies state
change operations to the renderer to move the view through time.

param renderTarget: The DOM element that the rendering engine will be bound to.
*/
var TIMELINE_WINDOW = 10
module.exports = Class("GraphicsEngineController", {
    'private _gameID': undefined,
    'private _activeActor': undefined,
    'private _is_hosting': false,
    'private _gameTitle': undefined,
    'private _updateLoop': null,
    'private _renderEngine': null,
    'private _camera': null,
    'private _camPos': null,
    'private _renderer': null,
    'private _smellMode': false,
    'private _updateLoop': null,
    'private _timeLine': null,
    'private _rtarget': null,
    'private _tool': "CAMERA",
    'private _use': "ADD",

    'private _popupStats': function (stats) {
        $('#cell-stats').show()

        $("div#cell-stats span#elevation").html(Math.round(100*stats.elevation)/100 + " meters");
        $("div#cell-stats span#cell-type").html(stats.type);
        $("div#cell-stats span#coords").html(stats.coords.x +  ", " + stats.coords.y );
        $("div#cell-stats div#stat-listing").empty();
        $("div#cell-stats div#stat-listing").append("<h4>Contents:</h4>");

        for (var i in stats.contents) {
            var cont = stats.contents[i];
            var element = $("<div class='cell-content-list'> </div>");
            var health = cont.health;
            var type = cont.type;

            $("<span> Type: </span><span id='type'>" + type + "</span><br>").appendTo(element);
            $("<span> Health: </span><span id='health'>" + health + "</span>").appendTo(element);

            $("div#stat-listing").append(element);
        }


    },
    /*
    Bind key events to camera or interaction actions

    param scene: The scene for which the events are fire from.
    */
    'private _setupKeys': function(scene) {
        scene.actionManager = new BABYLON.ActionManager(scene)
        scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnKeyDownTrigger,
            function (evt) {
                if(evt.sourceEvent.keyCode==16) {
                    this._camera.angularSensibilityX = 1000000000
                    this._camera.angularSensibilityY = 1000000000
                }
            }.bind(this)
        ))

        scene.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnKeyUpTrigger,
            function (evt) {
                if(evt.sourceEvent.keyCode==16) {
                    this._camera.angularSensibilityX = 1500
                    this._camera.angularSensibilityY = 1500
                }
            }.bind(this)
        ))
    },
    'public pauseSimulation': function () {
//        if(this._updateLoop != null)
//            clearInterval(this._updateLoop)
    },
    'public resumeSimulation': function () {
        var controller = this
//        this._updateLoop = setInterval(function () {
//            controller.nextFrame()
//        }, 1000)
    },
    'public nextFrame': function() {
        var controller = this
        if(this._gameID != undefined) {
            if (this._timeLine.cursor >= this._timeLine.interval.length - this._timeLine.window){
                var first = this._timeLine.last
                var last = this._timeLine.last + this._timeLine.window
                this._fetchTimeInterval(first,last,{
                    "success": function (data) {
                        console.log(data)
                        for(var diff in data){
                            controller._timeLine.cursor--
                            controller._timeLine.shift()
                            controller._timeLine.push(diff)
                        }
                    },
                    "failure": function(data) {
                        console.log("ERROR nextFrame")
                        console.log(data)
                    }
                })
            }

            if (this._timeLine.cursor < this._timeLine.interval.length - 1)
                this._renderer.patch(this._timeLine.interval[this._timeLine.cursor++])
        }
    },
    'public prevFrame': function() {
        var controller = this
        if(this._gameID != undefined) {
            if (this._timeLine.cursor <= this._timeLine.window){
                var first = this._timeLine.first - this._timeLine.window
                var last = this._timeLine.first
                if(first > 0) {
                    this._fetchTimeInterval(first,last,{
                        "success": function (data) {
                            console.log(data)
                            for(var diff in data) {
                                controller._timeLine.cursor++
                                controller._timeLine.pop()
                                controller._timeLine.unshift(diff)
                            }
                        },
                        "failure": function(data) {
                            console.log("ERROR prevFrame")
                            console.log(data)
                        }
                    })
                }
            }

            if (this._timeLine.cursor > 0)
                this._renderer.patch(this._timeLine.interval[this._timeLine.cursor--])

        }
    },
    'private _fetchTimeInterval': function(low, high, callback) {
        var controller = this
        $.ajax({
            type: "get",
            url: "/game/" + controller._gameID + "/turns?first=" + low + "&last=" + high,
            success: function (data) {
                callback["success"](data)
            },
            failure: function (data) {
                callback["failure"](data)
            }
        })
    },
    __construct: function(renderTarget) {
        var engine = new BABYLON.Engine(renderTarget, true)
        var scene  = new BABYLON.Scene(engine)
        var loader = new BABYLON.AssetsManager(scene)

        var camera = new BABYLON.ArcRotateCamera("camera", Math.PI/8,Math.PI/8,45, new BABYLON.Vector3(0,0,0), scene)
        camera.upperRadiusLimit = 55
        camera.lowerRadiusLimit = 15
        camera.upperBetaLimit = Math.PI/3
        camera.lowerBetaLimit = Math.PI/8

        camera.keysUp = []
        camera.keysDown = []
        camera.keysLeft = []
        camera.keysRight = []

        camera.panningSensibility = 100
        camera.angularSensibilityX = 1500
        camera.wheelPrecision = 25
        camera.attachControl(renderTarget)

        var renderer = WorldRenderer(renderTarget, engine, camera, scene, loader)

        this._renderEngine = engine
        this._camera = camera
        this._camPos = {x: 0, y: 0}
        this._renderer = renderer

        //this._setupKeys(scene)
        this._initializeButtons()
        this._initializeWindow()
        this.startSimulationEngine()
    },
    'private _initializeWindow': function() {
        var controller = this
        var renderer = this._renderer

        $(window).on('beforeunload', function (event)
        {
            return 'Leaving this page will clear your form.';
        });

        $(window).unload(function(){
            var turn = renderer.getStateProp("currentTurn");
            var gameid = controller._gameID;
            if (gameid && controller._is_hosting){
                $.ajax("/game/"+gameid+"/?stop=true&on_turn="+turn);
            }
        });
    },
    'private _initializeButtons': function () {
        var controller = this
        var renderer = this._renderer
        $("#toolbar-bottom .tool").click(function (evt) {
            $("#toolbar-bottom .tool").removeClass("selected")
            $(this).addClass("selected")
        })
        $("#toolbar-bottom .modifier").click(function (evt) {
            $("#toolbar-bottom .modifier").removeClass("selected")
            $(this).addClass("selected")
        })

        $("#add-raise").click(function (evt){controller.setUse("ADD")})
        $("#delete-lower").click(function (evt){controller.setUse("DELETE")})
        $("#camera").click(function (evt){controller.setTool("CAMERA")})
        $("#inspect").click(function (evt){controller.setTool("INSPECT")})

        $("#simulation-render-target").click(function(evt){
            var picked = renderer.pickCell(evt.clientX, evt.clientY)
            var coords = picked.pickedMesh.name.split(" ").map(function(x){return Number(x)})
            if(evt.ctrlKey)
                return
            if (controller._tool == "CAMERA") {
                controller._camera.angularSensibilityX = 1500
                controller._camera.angularSensibilityY = 1500
            }
            else {
                controller._camera.angularSensibilityX = 1000000000
                controller._camera.angularSensibilityY = 1000000000

                if(controller._tool == "INSPECT") {
                    console.log("INS")

                    stats = renderer.getCell(coords[0], coords[1])
                    console.log(stats)
                    controller._popupStats(stats)
                }
                else {
                    if(controller._use == "ADD") {
                        if (controller._tool == "TERRAIN") {
                            console.log("RAI_TER")
                        }
                        else if (controller._tool == "GRASS") {
                            console.log("ADD_GRA")
                        }
                        else if (controller._tool == "ROCK") {
                            console.log("ADD_ROC")
                        }
                        else if (controller._tool == "WATER") {
                            console.log("ADD_WAT")
                        }
                        else if (controller._tool == "PLANT") {
                            console.log("ADD_PLA")
                        }
                        else if (controller._tool == "MUSHROOM") {
                            console.log("ADD_MUS")
                        }
                        else if (controller._tool == "WALL") {
                            console.log("ADD_WAL")
                        }
                        else if (controller._tool == "BLOCK") {
                            console.log("ADD_BLO")
                        }
                        else if (controller._tool == "ACTOR") {
                            console.log("ADD_ACT")
                            controller._spawnActor(coord[0],coords[1])
                        }
                    }
                    else if(controller._use == "DELETE") {
                        if (controller._tool == "TERRAIN") {
                            console.log("LOW_TER")
                        }
                        else if (controller._tool == "GRASS") {
                            console.log("DEL_GRA")
                        }
                        else if (controller._tool == "ROCK") {
                            console.log("DEL_ROC")
                        }
                        else if (controller._tool == "WATER") {
                            console.log("DEL_WAT")
                        }
                        else if (controller._tool == "PLANT") {
                            console.log("DEL_PLA")
                        }
                        else if (controller._tool == "MUSHROOM") {
                            console.log("DEL_MUS")
                        }
                        else if (controller._tool == "WALL") {
                            console.log("DEL_WAL")
                        }
                        else if (controller._tool == "BLOCK") {
                            console.log("DEL_BLO")
                        }
                        else if (controller._tool == "ACTOR") {
                            console.log("DEL_ACT")
                        }
                    }
                }
            }

        })

        //IN GAME STUFF
        $("#pause-game-btn").click(function() {
            if ($(this).hasClass('disabled'))
            {
                return
            }
            controller.pauseSimulation();

            //Do something to stop the game-loop... First implement a game loop.

            $.ajax({
                type: "get",
                url: "/game/" + controller._gameID + "/?pause=true&on_turn=" + controller._currentTurn,
                success: function (data) {
                    console.log("Game paused.");
                    $("#pause-game-btn").addClass("disabled");
                    $("#resume-game-btn").removeClass("disabled");

                },
                failure: function (data) {
                    console.log(data)
                    controller.resumeSimulation()
                }
            });
        });


        $("#resume-game-btn").click(function()
        {
            if ($(this).hasClass('disabled'))
            {
                return
            }

            $.ajax({
                type: "get",
                url: "/game/" + controller._gameID + "/?resume=true",
                success: function (data) {
                    console.log("Game resumed.");
                    $("#resume-game-btn").addClass("disabled");
                    $("#pause-game-btn").removeClass("disabled");
                    controller.resumeSimulation();
                },
                failure: function (data) {
                    console.log(data)
                }
            });
        });
    },
    'public loadGame': function (gametitle, gameid, spectate) {
        if (spectate === undefined) //Added optional param to set up as spectator -AP.
            spectate = false;

        this._gameID = gameid
        this._gameTitle = gametitle
        var renderer = this._renderer
        var cam = this._camPos
        var controller = this
        if(spectate)
            this._is_hosting = false;
        else
            this._is_hosting = true;

        if(!spectate)
        {
            $.ajax({
                type: "get",
                url: "/game/"+gameid+"/?start=true",
                contentType:"application/json",
                statusCode: {
                    200: function(data)
                    {
                        console.log(data)
                    }
                }
            });
        }

        $.ajax({
            type: "get",
            url: "/game/"+gameid+"/?full_dump=true",
            contentType:"application/json",
            statusCode: {
                200: function(data)
                {
                    renderer.setWorldState(data)
                    renderer.updateView(cam)

                    var first = data["current_turn"] - 2*TIMELINE_WINDOW
                    first = (first < 0) ? 0 : first
                    var last = data["current_turn"] + 2*TIMELINE_WINDOW

                    controller._timeLine = {
                        "cursor": data["current_turn"],
                        "interval": []
                    }

                    controller._fetchTimeInterval(first, last, {
                        "success": function(data) {
                            console.log(data)
                            for(var diff in data)
                                controller._timeLine.push(diff)
                        },
                        "failure": function(data) {
                            console.log(data)
                        }
                    })

                    //Enable 'game' tab of side menu.
                    $("#side-game-menu-tab").removeClass("disabled");
                    $('#side-menu-tabs a[href="#side-game-menu"]').tab('show');

                    //Show game info.
                    $("#loaded-game-info").html("<b>Game: </b>" + gametitle + "<br><b>Turn</b> " + renderer.getStateProp("currentTurn"))
                }
            }
        })

        $("#advance-btn").click(
            function () {
                $.ajax({
                    type: "get",
                    url: "/game/"+gameid+"/?light_dump=true",
                    contentType:"application/json",
                    statusCode: {
                        200: function(data)
                        {
                            renderer.setWorldState(data)
                            renderer.updateView(cam)
                        }
                    }
                })
            }
        )
        /*
        if(this._updateLoop != null)
            clearInterval(this._updateLoop)

        this._updateLoop = setInterval(function () {
            $.ajax({
                type: "get",
                url: "/game/"+gameid+"/?light_dump=true",
                contentType:"application/json",
                statusCode: {
                    200: function(data)
                    {
                        renderer.updateWorldState(data)
                    }
                }
            })

            renderer.updateView(this._camPos.x, this._camPos.y)
        }.bind(this), 5000)
        */
    },
    /*
    Initialize the simulation view and start the render loop. Update the viewable
    chunks in the scene as the camera is moved
    */
    'public startSimulationEngine': function() {
        var loader = this._renderer.loadAssets()
        var control = this

        loader.onFinish = function() {
            //this._renderer.smellFieldOn()
            this._renderer.updateView(this._camPos)

            this._camPos = {x: 0, y: 0}

            this._renderEngine.runRenderLoop(function () {
                this._renderer.renderWorld()

                var camdist  = Math.abs(this._camPos.x - this._camera.target.x)
                    camdist += Math.abs(this._camPos.y - this._camera.target.z)

                if(camdist > 2) {
                    var newx = Math.floor(this._camera.target.x)
                    var newy = Math.floor(this._camera.target.z)
                    this._camPos = {x: newx, y: newy}
                    this._renderer.updateView(this._camPos)
                }
            }.bind(this))
        }.bind(this)

        loader.load()
    },
    /*
    Turn off smell field and close cell status window
    */
    'public setDefaultRenderSettings': function() {
        this._smellMode = false
        this._cellStatus = null
    },
    /*
    Turn the smell field on and off
    */
    'public setSmellMode': function(setting) {
        this._smellMode = setting
    },
    /*
    Open the cell status window for the cell at point (x,y)

    param x: cell x position
    param y: cell y position
    */
    'public getcellStatus': function(x,y) {
        return renderer.getCell(x,y)
    },
    /*
    Move the camera to the point (x,y) and update the scene.

    param x: view x position
    param y: view y position
    */
    'public moveCamera': function(x,y) {
        renderer.updateCam(x,y)
    },
    'public setUse': function (use) {
        console.log(use + " MODE")
        this._use = use
    },
    'public setTool': function (tool) {
        console.log(tool + " TOOL")
        this._tool = tool
    }
})
