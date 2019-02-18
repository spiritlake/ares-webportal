import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import AuthenticatedController from 'ares-webportal/mixins/authenticated-controller';

export default Controller.extend(AuthenticatedController, {
    gameApi: service(),
    flashMessages: service(),
    gameSocket: service(),
    session: service(),
    favicon: service(),

    scenePose: '',
    rollString: null,
    confirmDeleteScenePose: false,
    selectSkillRoll: false,
    selectLocation: false,
    newLocation: null,
    scrollPaused: false,

    onSceneActivity: function(msg /* , timestamp */) {
        let splitMsg = msg.split('|');
        let sceneId = splitMsg[0];
        let char = splitMsg[1];
        let poseData = splitMsg[2];
        // For poses we can just add it to the display.  Other events require a reload.
        if (sceneId === this.get('model.scene.id')) {
          if (poseData) {
            poseData = JSON.parse(poseData);
            let poses = this.get('model.scene.poses');
            if (!poseData.can_edit && (poseData.char.id == this.get('session.data.authenticated.id'))) {
              poseData.can_edit = true
              poseData.can_delete = true
            }
            poses.pushObject(poseData);
            this.get('gameSocket').notify('New scene activity!');
            this.scrollSceneWindow();
          } else {
            this.get('gameApi').requestOne('liveScene', { id: this.get('model.scene.id') }).then( response => {
              this.set(`model.scene`, response)
              this.get('gameSocket').notify('New scene activity!');
              this.scrollSceneWindow();
           });
          }
        }
        else {
            this.get('model.my_scenes').forEach(s => {
                if (s.id === sceneId) {
                    s.set('is_unread', true);
                    this.get('gameSocket').notify('New activity in one of your other scenes!');
                }
            });
        }
    },

    rollEnabled: function() {
      return this.get('model.abilities').length > 0;
    }.property('model.abilities'),

    pageTitle: function() {
        return 'Scene ' + this.get('model.scene.id');
    }.property('model.scene.id'),

    resetOnExit: function() {
        this.set('scenePose', '');
        this.set('rollString', null);
        this.set('confirmDeleteScenePose', false);
        this.set('selectSkillRoll', false)
    },

    setupCallback: function() {
        let self = this;

        this.get('gameSocket').set('sceneCallback', function(data) {
            self.onSceneActivity(data) } );
    },

    showSceneSelection: function() {
      return this.get('model.my_scenes').length > 0;
    }.property('model.my_scenes.@each.id'),

    scrollSceneWindow: function() {
      // Unless scrolling paused
      if (this.get('scrollPaused')) {
        return;
      }

        try {
          $('#live-scene-log').stop().animate({
              scrollTop: $('#live-scene-log')[0].scrollHeight
          }, 800);
        }
        catch(error) {
          // This happens sometimes when transitioning away from screen.
        }

    },

    scenePoses: function() {
        return this.get('model.scene.poses').map(p => Ember.Object.create(p));
    }.property('model.scene.poses.@each.id'),

    actions: {
        locationSelected(loc) {
            this.set('newLocation', loc);
        },
        changeLocation() {
            let api = this.get('gameApi');

            let newLoc = this.get('newLocation');
            if (!newLoc) {
                this.get('flashMessages').danger("You haven't selected a location.");
                return;
            }
            this.set('selectLocation', false);
            this.set('newLocation', null);

            api.requestOne('changeSceneLocation', { scene_id: this.get('model.scene.id'),
                location: newLoc })
            .then( (response) => {
                if (response.error) {
                    return;
                }
            });
        },

        cookies() {
            let api = this.get('gameApi');
            api.requestOne('sceneCookies', { id: this.get('model.scene.id') }, null)
            .then( (response) => {
                if (response.error) {
                    return;
                }
                this.get('flashMessages').success('You give cookies to the scene participants.');
            });
        },

        editScenePose(scenePose) {
            scenePose.set('editActive', true);
        },
        cancelScenePoseEdit(scenePose) {
            scenePose.set('editActive', false);
        },
        deleteScenePose() {
            let api = this.get('gameApi');
            let poseId = this.get('confirmDeleteScenePose.id');
            this.set('confirmDeleteScenePose', false);

            let scenePose = this.get('model.scene.poses').find(p => p.id === poseId);
            this.get('model.scene.poses').removeObject(scenePose);

            api.requestOne('deleteScenePose', { scene_id: this.get('model.scene.id'),
                pose_id: poseId })
            .then( (response) => {
                if (response.error) {
                    return;
                }
            });
        },
        saveScenePose(scenePose, notify) {
            let pose = scenePose.get('raw_pose');
            if (pose.length === 0) {
                this.get('flashMessages').danger("You haven't entered anything.");
                return;
            }
            scenePose.set('editActive', false);
            scenePose.set('pose', pose);

            let api = this.get('gameApi');
            api.requestOne('editScenePose', { scene_id: this.get('model.scene.id'),
                pose_id: scenePose.id, pose: pose, notify: notify })
            .then( (response) => {
                if (response.error) {
                    return;
                }
                scenePose.set('pose', response.pose);
            });
            this.set('scenePose', '');
        },

        addPose(poseType) {
            let pose = this.get('scenePose');
            if (pose.length === 0) {
                this.get('flashMessages').danger("You haven't entered anything.");
                return;
            }
            let api = this.get('gameApi');
            this.set('scenePose', '');
            api.requestOne('addScenePose', { id: this.get('model.scene.id'),
                pose: pose, pose_type: poseType })
            .then( (response) => {
                if (response.error) {
                    return;
                }
                this.scrollSceneWindow();
            });
        },

        addTxt() {
            let pose = this.get('scenePose');
            if (pose.length === 0) {
                this.get('flashMessages').danger("You haven't entered anything.");
                return;
            }
            let api = this.get('gameApi');
            api.requestOne('addTxt', { scene_id: this.get('model.scene.id'),
                pose: pose }, null)
            .then( (response) => {
                if (response.error) {
                    this.get('flashMessages').error(response.error);
                    return;
                }
                this.set('scenePose', '');
                this.scrollSceneWindow();
            });
        },        

        addSceneRoll() {
            let api = this.get('gameApi');

            // Needed because the onChange event doesn't get triggered when the list is
            // first loaded, so the roll string is empty.
            let rollString = this.get('rollString') || this.get('model.abilities')[0];

            if (!rollString) {
                this.get('flashMessages').danger("You haven't selected an ability to roll.");
                return;
            }
            this.set('selectSkillRoll', false);
            this.set('rollString', null);

            api.requestOne('addSceneRoll', { scene_id: this.get('model.scene.id'),
                roll_string: rollString })
            .then( (response) => {
                if (response.error) {
                    return;
                }
            });
        },

        addSceneSpell() {
            let api = this.get('gameApi');

            // Needed because the onChange event doesn't get triggered when the list is
            // first loaded, so the roll string is empty.
            let spellString = this.get('spellString') || this.get('model.spells')[0];

            if (!spellString) {
                this.get('flashMessages').danger("You haven't selected a spell to cast.");
                return;
            }
            this.set('selectCastSpell', false);
            this.set('spellString', null);

            api.requestOne('addSceneSpell', { scene_id: this.get('model.scene.id'),
                spell_string: spellString }, null)
            .then( (response) => {
                if (response.error) {
                  this.get('flashMessages').danger(response.error);
                    return;
                }
            });
        },


        changeSceneStatus(status) {
            let api = this.get('gameApi');
            if (status === 'share') {
                this.get('gameSocket').set('sceneCallback', null);
            }
            api.requestOne('changeSceneStatus', { id: this.get('model.scene.id'),
                status: status }, null)
            .then( (response) => {
                if (response.error) {
                    return;
                }
                if (status === 'share') {
                    this.get('flashMessages').success('The scene has been shared.');
                    this.transitionToRoute('scene', this.get('model.scene.id'));
                }
                else if (status === 'stop') {
                    this.get('flashMessages').success('The scene has been stopped.');
                    this.send('reloadModel');
                }
                else if (status === 'restart') {
                    this.get('flashMessages').success('The scene has been restarted.');
                    this.send('reloadModel');
                }
            });
        },

        muteScene(option) {
            let api = this.get('gameApi');
            api.requestOne('muteScene', { id: this.get('model.scene.id'),
                muted: option }, null)
            .then( (response) => {
                if (response.error) {
                    return;
                }
                let status = option ? 'muted' : 'unmuted';
                this.get('flashMessages').success(`The scene has been ${status}.`);
                this.send('reloadModel');
            });
        },

        scrollDown() {
          this.scrollSceneWindow();
        },

        refresh() {
            this.resetOnExit();
            this.send('reloadModel');
        },

        pauseScroll() {
          this.set('scrollPaused', true);
        },
        unpauseScroll() {
          this.set('scrollPaused', false);
          this.scrollSceneWindow();
        }
    }
});
