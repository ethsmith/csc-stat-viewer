import * as React from "react";
import Select, { MultiValue } from "react-select";
import { PlayerTypes } from "../../utils/player-utils";
import { useDataContext } from "../../../DataContext";

interface Props {
    //onChange: React.Dispatch<React.SetStateAction<MultiValue<{label: string;value: PlayerTypes[];}>>>;
    onChange: typeof React.useState<MultiValue<{label: string;value: PlayerTypes[];}>>;
    selectedOptions?: MultiValue<{label: string;value: PlayerTypes[];}>;
}

export const PlayerTypeFilter = React.memo(({ onChange, selectedOptions }: Props) => {

    const { players } = useDataContext();
    const isDraftEligibleDisabled = !players.some( player => player.type === PlayerTypes.DRAFT_ELIGIBLE);

    const selectClassNames = {
        placeholder: () => "text-gray-400 bg-inherit",
        container: () => "m-1 rounded bg-inherit z-10",
        control: () => "p-2 rounded-l bg-slate-700",
        option: (state : { isDisabled: boolean }) => `${state.isDisabled ? 'text-gray-500' : ''} p-2 hover:bg-slate-900`,
        input: () => "text-slate-200",
        menu: () => "bg-slate-900",
        menuList: () => "bg-slate-700 ",
        multiValue: () => "bg-sky-700 p-1 mr-1 rounded",
        multiValueLabel: () => "text-slate-200",
        multiValueRemove: () => "text-slate-800 pl-1",
        singleValue: () => "text-slate-200",
    };
    
    const viewPlayerTypeList = React.useMemo(() => ([
        { label: `Signed`, value: [PlayerTypes.SIGNED,PlayerTypes.INACTIVE_RESERVE,PlayerTypes.SIGNED_PROMOTED,PlayerTypes.SIGNED_SUBBED] },
        { label: `Free Agents`, value: [PlayerTypes.FREE_AGENT,PlayerTypes.TEMPSIGNED]},
        { label: `Draft Eligible`, value: [PlayerTypes.DRAFT_ELIGIBLE], isDisabled: isDraftEligibleDisabled },
        { label: `Perma FA`, value: [PlayerTypes.PERMANENT_FREE_AGENT,PlayerTypes.PERMFA_TEMP_SIGNED]},
        { label: `Inactive Reserve`, value: [PlayerTypes.INACTIVE_RESERVE]},
    ]), [isDraftEligibleDisabled]);


    return (
        <div className="flex flex-row text-xs my-2 mx-1">
            <label title="Player Type" className="p-1 leading-9">
                Type
            </label>
            <Select
                isMulti
                placeholder="All"
                isClearable={false}
                className="grow"
                unstyled
                value={selectedOptions}
                isSearchable={false}
                classNames={selectClassNames}
                options={viewPlayerTypeList}
                onChange={onChange}
            />
        </div>
    );
});