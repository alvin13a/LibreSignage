var $ = require('jquery');
var api = require('ls-api');
var user = require('ls-user');
var uic = require('ls-uicontrol');
var dialog = require('ls-dialog');
var bootstrap = require('bootstrap');

var flag_usermgr_ready = false;
var defer_usermgr_ready = () => { return !flag_usermgr_ready; }

const USER_SAVE_QUERY = (name) => `#btn-user-${name}-save`;
const USER_REMOVE_QUERY = (name) => `#btn-user-${name}-remove`;
const USER_CREATE = $('#btn-create-user');
const USERS_TABLE = $('#users-table');

const USERMGR_UI_DEFS = new uic.UIController({
	'USER_CREATE': new uic.UIButton(
		_elem = USER_CREATE,
		_perm = () => { return true; },
		_enabler = null,
		_attach = {
			'click': usermgr_create
		},
		_defer = defer_usermgr_ready
	)
})

const USERMGR_LIST_UI_DEFS = new uic.UIController({});

// Dialog messages.
const DIALOG_GROUPS_INVALID_CHARS = new dialog.Dialog(
	dialog.TYPE.ALERT,
	'Invalid user groups',
	`The user groups contain invalid characters. Only A-Z, a-z, 0-9
	and _ are allowed. Additionally the comma character can be used
	for separating different groups. Spaces can be used too, but they
	are removed from the group names when the changes are saved.`,
	null
);

const DIALOG_TOO_MANY_GROUPS = (max) => {
	return new dialog.Dialog(
		dialog.TYPE.ALERT,
		'Too many user groups',
		`You have specified too many groups for one user. The
		maximum number of groups is ${max}.`,
		null
	);
}

const DIALOG_USER_SAVED = new dialog.Dialog(
	dialog.TYPE.ALERT,
	'User saved',
	'User information was successfully saved!',
	null
);

const DIALOG_TOO_MANY_USERS = new dialog.Dialog(
	dialog.TYPE.ALERT,
	'Too many users',
	`The maximum number of users on the server has been reached.
	No more users can be created.`,
	null
);

const DIALOG_USER_REMOVE_FAILED = new dialog.Dialog(
	dialog.TYPE.ALERT,
	'User removal failed',
	'Failed to remove user.',
	null
);

const DIALOG_USER_NO_NAME = new dialog.Dialog(
	dialog.TYPE.ALERT,
	'Invalid username',
	'You must specify a username for the user to be created.',
	null
);

const DIALOG_USERNAME_TOO_LONG = new dialog.Dialog(
	dialog.TYPE.ALERT,
	'Invalid username',
	'The specified username is too long.',
	null
);

// User table row template.
const usr_table_row = (index, name, groups, pass) => `
	<div class="row usr-table-row" id="usr-row-${name}">
		<div id="usr-index-${name}" class="usr-table-col col-1">
			${index}
		</div>
		<div id="usr-name-${name}" class="usr-table-col col-2">
			${name}
		</div>
		<div id="usr-groups-${name}" class="usr-table-col col-3">
			${groups}
		</div>
		<div id="usr-info-${name}" class="usr-table-col col-3">
			${pass}
		</div>
		<div class="usr-table-col col-3">
			<button type="button"
				role="button"
				class="btn btn-primary"
				data-toggle="collapse"
				data-target="#usr-edit-${name}"
				aria-expanded="false"
				aria-controls="usr-collapse-${name}">
				<i class="fas fa-edit"></i>
			</button>
		</div>
	</div>
	<div class="collapse usr-edit-row" id="usr-edit-${name}">
		<div class="usr-edit-row-container">
			<div class="row usr-edit-input-row">
				<label class="col-3 col-form-label"
					for="usr-name-input-${name}">
					User
				</label>
				<div class="col-9">
					<input id="usr-name-input-${name}"
						type="text"
						class="form-control"
						value="${name}"
						readonly>
					</input>
				</div>
			</div>
			<div class="row usr-edit-input-row">
				<label class="col-3 col-form-label"
					for="usr-groups-input-${name}">
					Groups
				</label>
				<div class="col-9">
					<input id="usr-groups-input-${name}"
						type="text"
						class="form-control"
						value="${groups}">
					</input>
				</div>
			</div>
			<div class="row usr-edit-input-row">
					<div class="col-12 d-flex flex-row justify-content-center">
					<input
						id="btn-user-${name}-save"
						class="btn btn-primary usr-edit-btn"
						type="submit"
						value="Save">
					</input>
					<input
						id="btn-user-${name}-remove"
						class="btn btn-danger usr-edit-btn"
						type="button"
						value="Remove">
					</input>
				</div>
			</div>
		</div>
	</div>
`;

function usermgr_assign_userdata(name) {
	/*
	*  Assign the edited user data to 'user' from
	*  the user manager UI.
	*/
	var tmp = '';
	var users = user.users_get();
	if (!user.user_exists(name)) {
		throw new Error("User doesn't exist!");
	}

	for (var u in users) {
		if (users[u].get_name() == name) {
			tmp = $(`#usr-groups-input-${users[u].get_name()}`).val();
			/*
			*  Only allow alphanumerics, underscore,
			*  space and comma in group names.
			*/
			if (tmp.match(/[^A-Za-z0-9_, ]/g)) {
				DIALOG_GROUPS_INVALID_CHARS.show();
				return false;
			}

			// Strip whitespace and empty groups.
			tmp = tmp.replace(/\s+/g, '');
			tmp = tmp.replace(/,+/g, ',');
			tmp = tmp.replace(/,$/, '');
			users[u].groups = tmp.split(',');

			// Check that the number of groups is valid.
			if (users[u].groups.length >
				API.SERVER_LIMITS.MAX_GROUPS_PER_USER) {
				DIALOG_TOO_MANY_GROUPS(
					API.SERVER_LIMITS.MAX_GROUPS_PER_USER
				).show();
				return false;
			}
			return true;
		}
	}
}

function usermgr_save(name) {
	/*
	*  Save a user.
	*/
	var users = user.users_get();
	for (var u in users) {
		if (users[u].get_name() == name) {
			if (!usermgr_assign_userdata(name)) {
				console.error('Failed to save userdata.');
				return;
			}
			users[u].save((err) => {
				if (API.handle_disp_error(err)) { return; }
				// Update UI.
				usermgr_make_ui();
				DIALOG_USER_SAVED.show();
			});
			break;
		}
	}
}

function usermgr_remove(name) {
	/*
	*  Remove a user.
	*/
	var users = user.users_get();
	dialog.dialog(dialog.TYPE.CONFIRM,
		`Remove user ${name}?`,
		`Are you sure you want to remove the user ${name}? ` +
		`All user data for ${name} will be lost and won't be ` +
		`recoverable.`,
		(status, val) => {
			for (var u in users) {
				if (users[u].get_name() != name) { continue; }
				users[u].remove((resp) => {
					if (API.handle_disp_error(resp)) { return; }
					user.users_load(API, usermgr_make_ui);
				});
				return;
			}
			DIALOG_USER_REMOVE_FAILED.show();
		}
	);
}

function usermgr_create() {
	dialog.dialog(
		dialog.TYPE.PROMPT,
		'Create a user',
		'Enter a name for the new user.', (status, val) => {
		if (!status) { return; }
		if (!val.length) {
			DIALOG_USER_NO_NAME.show();
			return;
		}
		if (val.length > API.SERVER_LIMITS.USERNAME_MAX_LEN) {
			DIALOG_USERNAME_TOO_LONG.show();
			return;
		}

		API.call(API.ENDP.USER_CREATE, {'user': val}, (resp) => {
			if (resp.error == API.ERR.LIMITED) {
				DIALOG_TOO_MANY_USERS.show();
				return;
			} else if (API.handle_disp_error(resp.error)) {
				return;
			}

			var tmp = new user.User(API);
			tmp.set(
				resp.user.name,
				resp.user.groups,
				null
			);
			tmp.set_info('Password: ' + resp.user.pass);
			user.users_add(tmp);
			usermgr_make_ui();
		});
	});
}

function usermgr_make_ui() {
	/*
	*  Render the user manager UI.
	*/
	var users = user.users_get();
	var i = 0;

	USERMGR_LIST_UI_DEFS.rm_all();
	USERS_TABLE.empty();

	for (var u in users) {
		let name = users[u].get_name();
		let grps = users[u].get_groups();
		let info = users[u].get_info();
		USERS_TABLE.append(usr_table_row(
			i,
			name,
			!grps || !grps.length ? '' : grps.join(', '),
			!info ? '' : info,
		));
		USERMGR_LIST_UI_DEFS.add(`${name}_save`, new uic.UIButton(
			_elem = $(USER_SAVE_QUERY(name)),
			_perm = () => { return true; },
			_enabler = null,
			_attach = {
				'click': () => { usermgr_save(name); }
			},
			_defer = null
		));
		USERMGR_LIST_UI_DEFS.add(`${name}_remove`, new uic.UIButton(
			_elem = $(USER_REMOVE_QUERY(name)),
			_perm = () => { return name != API.CONFIG.user; },
			_enabler = null,
			_attach = {
				'click': () => { usermgr_remove(name); }
			},
			_defer = null
		));
		i++;
	}
	USERMGR_LIST_UI_DEFS.all(function() { this.state(); });
}

$(document).ready(() => {
	API = new api.API(
		null,
		() => {
			user.users_load(API, usermgr_make_ui);
			flag_usermgr_ready = true;
		}
	);
});