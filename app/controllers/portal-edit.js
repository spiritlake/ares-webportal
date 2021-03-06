import Controller from '@ember/controller';
import { inject as service } from '@ember/service';

export default Controller.extend({
    flashMessages: service(),
    gameApi: service(),

    actions: {
        gmsChanged(new_gms) {
          this.set('model.portal.gms', new_gms);
        },
        creaturesChanged(new_creatures) {
          this.set('model.portal.creatures', new_creatures);
        },
        plotsChanged(new_plots) {
          this.set('model.portal.plots', new_plots);
        },
        allschoolsChanged(new_schools) { 
          this.set('model.portal.all_schools', new_schools);
        },
        bannerImageChanged(image) {
            this.set('model.portal.banner_image', image);
        },
        profileImageChanged(image) {
            this.set('model.portal.profile_image', image);
        },
        primaryschoolChanged(new_school) {
          this.set('model.portal.primary_school', new_school);
        },
        save() {
            let api = this.get('gameApi');
            api.requestOne('portalEdit', {
               id: this.get('model.portal.id'),
               name: this.get('model.portal.name'),
               gms: (this.get('model.portal.gms') || []).map(gm => gm.name),
               creatures: (this.get('model.portal.creatures') || []).map(creature => creature.id),
               plots: (this.get('model.portal.plots') || []).map(plot => plot.id),
               location: this.get('model.portal.location'),
               location_known: this.get('model.portal.location_known'),
               latitude: this.get('model.portal.latitude'),
               longitude: this.get('model.portal.longitude'),
               primary_school: this.get('model.portal.primary_school'),
               all_schools: (this.get('model.portal.all_schools') || []).map(s => s),
               pinterest: this.get('model.portal.pinterest'),
               banner_image: this.get('model.portal.banner_image.name'),
               profile_image: this.get('model.portal.profile_image.name'),
               image_gallery: this.get('model.portal.image_gallery'),
               description: this.get('model.portal.edit_desc'),
               society: this.get('model.portal.edit_society'),
               other_creatures: this.get('model.portal.edit_other_creatures'),
               npcs: this.get('model.portal.edit_npcs'),
               trivia: this.get('model.portal.edit_trivia'),
               rp_suggestions: this.get('model.portal.edit_rp_suggestions'),
               short_desc: this.get('model.portal.edit_short_desc'),
               events: this.get('model.portal.edit_events')}, null)
            .then( (response) => {
                if (response.error) {
                    return;
                }
                this.transitionToRoute('portal',
                this.get('model.portal.id'));
                this.get('flashMessages').success('Portal updated!');
            });
        }
    }
});
