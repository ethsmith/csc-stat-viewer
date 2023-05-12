import * as React from "react";
import { Container } from "../common/components/container";
import { useDataContext } from '../DataContext';
import { Loading } from '../common/components/loading';
//import { PlayerStats } from '../models';

export function Teams() {
    const { franchises = [], isLoading } = useDataContext();
    //const playerStats: PlayerStats[] = players.filter( p => Boolean(p.stats) ).map( p => p.stats) as PlayerStats[];
    
    return (
        <Container>
            <div className="mx-auto max-w-lg text-center">
                <h2 className="text-3xl font-bold sm:text-4xl">Teams</h2>
                <p className="mt-4 text-gray-300">
                    Current Teams and players on those teams + roles.
                </p>
            </div>
            <hr className="h-px my-4 bg-gray-200 border-0 dark:bg-gray-800" />
            { isLoading && <Loading /> }
            {
                franchises.map( franchise => 
                    <div className="my-4 block bg-midnight2 rounded-xl border border-gray-800 shadow-xl transition hover:border-pink-500/10 hover:shadow-pink-500/10">
                    <div className="flex flex-row justify-between">
                        <div className="mr-4 h-[64px] w-[64px] rounded-tl-xl">
                            <img className="rounded-tl-xl rounded-br-xl" src={`https://core.csconfederation.com/images/${franchise.logo.name}`} alt=""/>
                        </div>
                        <div className="pt-2 grow">
                            <h2 className="text-xl font-bold text-white grow text-center">{franchise.name} - <i>{franchise.prefix}</i></h2>
                            <div className="text-center text-sm">
                                GM - {franchise.gm.name} | AGM - {franchise.agm?.name}
                            </div>
                            <div className="grid grid-cols-2 gap-4 md:grid-cols-2 lg:grid-cols-6 p-1 text-sm text-gray-300">
                                { franchise.teams.map( team =>      
                                        <div>
                                                <div className="border-b-[1px] border-slate-700 text-center">
                                                    <strong>{team.name}</strong>
                                                </div>
                                                <div className="px-2">
                                                { team.players.map( player => 
                                                    <div>{player.name}</div>
                                                    )}
                                                </div>
                                        </div>
                                    )
                                }
                           </div>
                        </div>
                    </div>
                </div>
                    )
            }
        </Container>
    );
}