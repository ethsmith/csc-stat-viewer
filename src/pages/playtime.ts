import axios from "axios";

export async function getRecentPlaytimeForGame(steamId: string) : Promise<number> {
    const response = await axios.get("https://scoutcsc.gg:3001", {
        params: {
            steam_id: steamId,
        }
    });

    if (!response) {
        console.log("No response from server");
        return 0;
    }

    const playtime = response.data.time;

    if (!playtime) {
        return 0;
    }

    return  playtime;
}