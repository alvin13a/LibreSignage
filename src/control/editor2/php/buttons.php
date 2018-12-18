<!-- Editor control buttons -->
<div class="row form-group container-fluid d-flex justify-content-center mx-0 px-0">
	<button id="btn-slide-new"
		type="button"
		class="btn btn-success btn-slide-ctrl"
		data-toggle="tooltip"
		title="Create slide.">
		<i class="fas fa-plus-circle"></i>
	</button>
	<button id="btn-slide-save"
		type="button"
		class="btn btn-success btn-slide-ctrl"
		data-toggle="tooltip"
		title="Save slide.">
		<i class="fas fa-save"></i>
	</button>
	<button id="btn-slide-duplicate"
		type="button"
		class="btn btn-success btn-slide-ctrl"
		data-toggle="tooltip"
		title="Duplicate slide.">
		<i class="fas fa-copy"></i>
	</button>
	<button id="btn-slide-preview"
		type="button"
		class="btn btn-success btn-slide-ctrl"
		data-toggle="tooltip"
		title="Preview slide.">
		<i class="fas fa-eye"></i>
	</button>
	<div class="dropdown">
		<button id="btn-slide-move"
			type="button"
			class="btn btn-success btn-slide-ctrl dropdown-toggle"
			data-toggle="dropdown"
			aria-haspopup="true"
			aria-expanded="false">
			<i class="fas fa-arrow-circle-right"></i>
		</button>
		<div class="dropdown-menu" id="dropdown-slide-move" aria-labelledby="btn-slide-move">
		</div>
	</div>
	<div class="dropdown">
		<button id="btn-slide-remove"
			type="button"
			class="btn btn-danger btn-slide-ctrl dropdown-toggle"
			data-toggle="dropdown"
			aria-haspopup="true"
			aria-expanded="false">
			<i class="fas fa-trash-alt"></i>
		</button>
		<div class="dropdown-menu" id="dropdown-slide-remove" aria-labelledby="btn-slide-remove">
			<span>Remove slide?</span>
			<button class="btn btn-success btn-slide-ctrl"
				id="btn-slide-remove-continue"
				type="button">
				<i class="fas fa-check"></i>
			</button>
			<button class="btn btn-danger btn-slide-ctrl"
				type="button"
				id="btn-slide-remove-cancel">
				<i class="fas fa-times"></i>
			</button>
		</div>
	</div>
</div>