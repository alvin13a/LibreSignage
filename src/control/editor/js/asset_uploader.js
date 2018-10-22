var $ = require('jquery');
var uic = require('ls-uicontrol');
var popup = require('ls-popup');
var val = require('ls-validator');
var slide = require('ls-slide');
var dialog = require('ls-dialog');

var DIALOG_CONFIRM_REMOVE = (name, callback) => {
	return new dialog.Dialog(
		dialog.TYPE.CONFIRM,
		`Remove ${name}?`,
		`Are you sure you want to remove '${name}'?`,
		callback
	);
}

/*
*  Asset URL template string. 'origin' is the origin URL,
*  ie. the protocol and hostname. 'slide_id' is the slide id
*  and 'name' is the original asset name.
*/
const asset_url_template = (origin, slide_id, name) => `
${origin}/api/endpoint/slide/asset/slide_get_asset.php
?${$.param({ 'id': slide_id, 'name': name })}
`;

/*
*  Asset uploader thumbnail template literal.
*  'slide_id' is the slide id to use, 'name' is
*  the original asset name and 'index' is a unique
*  index number for each thumbnail.
*/
const asset_thumb_template = (slide_id, name, index) => `
<div id="asset-uploader-thumb-${index}" class="asset-uploader-thumb">
	<div class="asset-uploader-thumb-inner default-border">
		<div class="asset-uploader-thumb-img-wrapper">
			<img src="/api/endpoint/slide/asset/slide_get_asset_thumb.php
					?${$.param({ 'id': slide_id, 'name': name })}">
			</img>
		</div>
		<div class="asset-uploader-thumb-label-wrapper">
			<div class="asset-uploader-thumb-rm-wrapper">
				<button id="asset-uploader-thumb-rm-${index}"
						class="btn btn-danger small-btn"
						type="button">
					<i class="fas fa-times"></i>
				</button>
			</div>
			<div class="asset-uploader-thumb-label">
				${name}
			</div>
		</div>
	</div>
</div>
`;

const VALID_MIMES = {
	jpeg: 'image/jpeg',
	png: 'image/png',
	gif: 'image/gif'
};
const FILENAME_MAXLEN = 64;
const FILENAME_REGEX = /^[A-Za-z0-9_.-]*$/;

module.exports.AssetUploader = class AssetUploader {
	constructor(api) {
		this.API = api;

		this.state = {
			visible: false,
			uploading: false,
			ready: false
		}
		this.slide = new slide.Slide(this.API);

		this.FILELIST_UI = null;
		this.UI = new uic.UIController({
			'POPUP': new uic.UIStatic(
				elem = new popup.Popup(
					$("#asset-uploader").get(0),
					() => {
						// Reset the asset uploader data on close.
						this.UI.get('FILESEL_LABEL').set('Choose a file');
						this.UI.get('FILELINK').clear();
						this.UI.get('FILELIST').set('');
					}
				),
				perm = (d) => { return d['v']; },
				enabler = (elem, s) => { elem.visible(s); },
				attach = null,
				defer = null,
				getter = null,
				setter = null
			),
			'FILESEL': new uic.UIInput(
				elem = $("#asset-uploader-filesel"),
				perm = (d) => { return d['s']; },
				enabler = null,
				attach = {
					'change': (e) => {
						var label = '';
						var files = e.target.files;
						for (let i = 0; i < files.length; i++) {
							if (label.length !== 0) { label += ', '; }
							label += files.item(i).name;
						}
						this.UI.get('FILESEL_LABEL').set(label);

						// Remove error styling from the upload button.
						this.indicate('upload-success');
					}
				},
				defer = () => { this.defer_ready(); },
				mod = null,
				getter = (elem) => { return elem.prop('files'); },
				setter = (elem, s) => { elem.prop('files', s); },
				clearer = (elem) => { elem.prop('files', null); }
			),
			'FILESEL_LABEL': new uic.UIStatic(
				elem = $("#asset-uploader-filesel-label"),
				perm = (d) => { return true; },
				enabler = null,
				attach = null,
				defer = null,
				getter = (elem) => { return elem.html(); },
				setter = (elem, val) => { elem.html(val); }
			),
			'UPLOAD_BUTTON': new uic.UIButton(
				elem = $("#asset-uploader-upload-btn"),
				perm = (d) => { return d['s'] && !d['u'] && d['f']; },
				enabler = null,
				attach = {
					'click': () => {
						/*
						*  Handle upload button clicks. This listener
						*  also applies the necessary styling to the
						*  upload button and to the filelist on errors
						*  using this.indicate().
						*/
						this.state.uploading = true;
						this.update_controls();

						this.indicate('upload-success');
						this.indicate('upload-uploading');

						this.upload((resp) => {
							this.indicate('upload-success');
							if (resp.error) {
								this.indicate('upload-error');
							}

							this.update_and_populate();

							this.state.uploading = false;
							this.update_controls();
						});
					}
				},
				defer = () => { this.defer_ready(); },
			),
			'CANT_UPLOAD_LABEL': new uic.UIStatic(
				elem = $("#asset-uploader-cant-upload-row"),
				perm = (d) => { return !d['s']; },
				enabler = (elem, s) => {
					if (s) {
						elem.show();
					} else {
						elem.hide();
					}
				},
				attach = null,
				defer = null,
				getter = null,
				setter = null
			),
			'FILELIST': new uic.UIStatic(
				elem = $("#asset-uploader-filelist"),
				perm = (d) => { return true; },
				enabler = null,
				attach = null,
				defer = null,
				getter = null,
				setter = (elem, val) => { elem.html(val); }
			),
			'FILELINK': new uic.UIInput(
				elem = $("#asset-uploader-file-link-input"),
				perm = (d) => { return d['s']; },
				enabler = (elem, s) => { elem.prop('disabled', !s); },
				attach = null,
				defer = null,
				mod = null,
				getter = (elem) => { return elem.val(); },
				setter = (elem, val) => { elem.val(val); },
				clearer = (elem) => { elem.val(''); }
			)
		});

		/*
		*  Create validators and triggers for the file selector.
		*/
		this.fileval_sel = new val.ValidatorSelector(
			$("#asset-uploader-filesel"),
			$("#asset-uploader-filesel-cont"),
			[new val.FileSelectorValidator(
				{
					mimes: Object.values(VALID_MIMES),
					name_len: null,
					regex: null,
					minfiles: null,
					bl: null
				},
				`Invalid file type. The allowed types are: ` +
				`${Object.keys(VALID_MIMES).join(', ')}.`
			),
			new val.FileSelectorValidator(
				{
					mimes: null,
					name_len: FILENAME_MAXLEN,
					regex: null,
					minfiles: null,
					bl: null
				},
				`Filename too long. The maximum length ` +
				`is ${FILENAME_MAXLEN}`
			),
			new val.FileSelectorValidator(
				{
					mimes: null,
					name_len: null,
					regex: FILENAME_REGEX,
					minfiles: null,
					bl: null
				},
				"Invalid characters in filename. " + 
				"A-Z, a-z, 0-9, ., _ and - are allowed."
			),
			new val.FileSelectorValidator(
				{
					mimes: null,
					name_len: null,
					regex: null,
					minfiles: null,
					bl: () => {
						let tmp = [];
						if (this.slide && this.slide.get('assets')) {
							for (let a of this.slide.get('assets')) {
								tmp.push(a['filename']);
							}
						}
						return tmp;
					}
				}, 'At least one of the selected files already exists.'
			),
			new val.FileSelectorValidator(
				{
					mimes: null,
					name_len: null,
					regex: null,
					minfiles: 1,
					bl: null
				}, '', true
			)]
		);

		(this.fileval_trig = new val.ValidatorTrigger(
			[ this.fileval_sel ],
			(valid) => { this.update_controls(); }
		)).trigger();

		this.state.ready = true;
	}

	defer_ready() {
		return !this.state.ready;
	}

	indicate(status) {
		/*
		*  Indicate information to the user via CSS styling.
		*/
		switch (status) {
			// Filelist indicators.
			case 'filelist-error':
				this.UI.get(
					'FILELIST'
				).get_elem().parent().addClass(
					'error'
				);
				break;
			case 'filelist-success':
				this.UI.get(
					'FILELIST'
				).get_elem().parent().removeClass(
					'error'
				);
				break;

			// Upload button indicators.
			case 'upload-uploading':
				this.UI.get('UPLOAD_BUTTON').get_elem().addClass(
					'uploading'
				);
				break;
			case 'upload-error':
				this.UI.get('UPLOAD_BUTTON').get_elem().addClass(
					'error'
				);
				break;
			case 'upload-success':
				this.UI.get('UPLOAD_BUTTON').get_elem().removeClass(
					'uploading error'
				);
				break;
			default:
				break;
		}
	}

	update_controls() {
		/*
		*  Update the controls state.
		*    s  = Is this.slide null?
		*    u  = Is uploading in progress?
		*    v  = Is the popup visible?
		*    f  = Is the file validator input validated?
		*/
		this.UI.all(
			function(d) { this.state(d); },
			{
				's': this.slide != null,
				'u': this.state.uploading,
				'v': this.state.visible,
				'f': this.fileval_trig.is_valid()
			}
		);
	}

	upload(callback) {
		/*
		*  Upload the selected files to the slide that's loaded.
		*  'callback' is passed straight to API.call() as the
		*  callback argument.
		*/
		let data = new FormData();
		let files = this.UI.get('FILESEL').get();
		if (files.length) {
			for (let i = 0; i < files.length; i++) {
				data.append(i, files.item(i));
			}
			data.append('body', JSON.stringify({
				'id': this.slide.get('id')
			}));
			this.API.call(
				this.API.ENDP.SLIDE_UPLOAD_ASSET,
				data,
				callback
			);
		}
	}

	remove(name) {
		/*
		*  Remove the slide asset named 'name' from the
		*  loaded slide. This function handles indicating
		*  any errors.
		*/
		this.API.call(
			this.API.ENDP.SLIDE_REMOVE_ASSET,
			{
				'id': this.slide.get('id'),
				'name': name
			},
			(resp) => {
				if (this.API.handle_disp_error(resp.error)) { return; }
				this.update_and_populate();
			}
		);
	}

	update_and_populate() {
		/*
		*  Load new slide data and call this.populate(). This
		*  function also handles indicating any errors.
		*/
		this.update_slide((err) => {
			if (!err) {
				this.indicate('filelist-success');
				this.populate();
			} else {
				this.indicate('filelist-error');
			}
		});
	}

	populate() {
		/*
		*  Populate the existing asset list with data from 'this.slide'.
		*/
		let html = '';

		if (!this.slide.get('assets')) { return; }

		// Generate HTML.
		for (let i = 0; i < this.slide.get('assets').length; i++) {
			html += asset_thumb_template(
				this.slide.get('id'),
				this.slide.get('assets')[i].filename,
				i
			);
		}
		this.UI.get('FILELIST').set(html);

		/*
		*  Create UIElem objects for the asset 'buttons' and attach
		*  event handlers to them. The UIController is stored in
		*  this.FILELIST_UI.
		*/
		let tmp = {};
		for (let i = 0; i < this.slide.get('assets').length; i++) {
			let a = this.slide.get('assets')[i];

			// Asset select "button" handling.
			tmp[i] = new uic.UIButton(
				elem = $(`#asset-uploader-thumb-${i}`),
				perm = null,
				enabler = null,
				attach = {
					'click': (e) => {
						this.UI.get('FILELINK').set(asset_url_template(
							window.location.origin,
							this.slide.get('id'),
							a.filename
						));
					}
				},
				defer = () => { this.defer_ready(); }
			);

			// Asset remove button handling.
			tmp[`${i}_rm`] = new uic.UIButton(
				elem = $(`#asset-uploader-thumb-rm-${i}`),
				perm = null,
				enabler = null,
				attach = {
					'click': (e) => {
						DIALOG_CONFIRM_REMOVE(
							a.filename,
							(status, val) => {
								if (!status) { return; }
								this.remove(a.filename);
							}
						).show();
						e.stopPropagation();
					}
				}
			)
		}
		this.FILELIST_UI = new uic.UIController(tmp);
	}

	load_slide(slide_id, callback) {
		/*
		*  Load slide data. 'slide_id' is the slide id to use.
		*  'callback' is called afterwards with the returned
		*  API error code as the first argument.
		*/
		this.slide.load(slide_id, true, false, (err) => {
			if (callback) { callback(err); }
		});
	}

	update_slide(callback) {
		/*
		*  Update slide data. 'callback' is called afterwards
		*  with the returned API error code as the first argument.
		*/
		this.slide.fetch((err) => {
			if (callback) { callback(err); }
		});
	}

	show(slide_id, callback) {
		/*
		*  Show the asset uploader for the slide 'slide_id'.
		*  If slide_id == null, the asset uploader is opened
		*  but all the upload features are disabled. Note that
		*  you should load the slide before calling this
		*  function, lock it *and* enable lock renewal. This
		*  makes sure that a) this function can modify the slide
		*  and b) this function doesn't have to take care of
		*  renewing slide locks. An error is thrown if this
		*  function can't lock the slide. 'callback' is called
		*  after the asset uploader is ready. The resulting API
		*  error code is passed as the first argument.
		*/
		if (slide_id) {
			this.load_slide(slide_id, (err) => {
				if (err) {
					if (callback) { callback(err); }
					return;
				}
				this.populate();
				this.state.visible = true;
				this.update_controls();
				if (callback) { callback(err); }
			});
		} else {
			this.state.visible = false;
			this.update_controls();
			if (callback) { callback(this.API.ERR.API_E_OK); }
		}
	}
}
