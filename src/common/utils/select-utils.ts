export const selectClassNames = {
	placeholder: () => "text-gray-400 bg-inherit",
	container: () => "m-1 rounded bg-inherit",
	control: () => "p-2 rounded-l bg-slate-700",
	option: (state: { isDisabled: boolean }) => `${state.isDisabled ? "text-gray-500" : ""} p-2 hover:bg-slate-900`,
	input: () => "text-slate-200",
	menu: () => "bg-slate-900",
	menuList: () => "bg-slate-700",
	multiValue: () => "bg-sky-700 p-1 mr-1 rounded",
	multiValueLabel: () => "text-slate-200",
	multiValueRemove: () => "text-slate-800 pl-1",
	singleValue: () => "text-slate-200",
	clearIndicator: () => "",
	dropdownIndicator: () => "",
	group: () => "",
	groupHeading: () => "",
	indicatorsContainer: () => "",
	indicatorSeparator: () => "",
	loadingIndicator: () => "",
	loadingMessage: () => "",
	menuPortal: () => "",
	noOptionsMessage: () => "",
	valueContainer: () => "",
};
