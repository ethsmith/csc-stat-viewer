import { EChartsOption } from "echarts";
import * as React from "react";
import ReactECharts from "echarts-for-react";
import { PlayerStats } from "../../models";

type Props = {
    player: PlayerStats,
}

export function TeamSideRatingPie( { player }: Props) {
        
        const defaultOptions: EChartsOption = {
            color: ['#4169e1','#ff6347'],
            title: {
                text: 'Team Rating',
                top: '16px',
                textStyle: {
                    color: '#fff'
                },
                //subtext: 'Fake Data',
                left: 'center'
              },
            series:
              {
                //width: '200px',
                height: '200px',
                name: 'Rating',
                type: 'pie',
                radius: ['0%', '55%'],
                center: ['50%', '52%'],
                startAngle: 270,
                avoidLabelOverlap: false,
                itemStyle: {
                  borderRadius: 4,
                  borderColor: '#1d1d31',
                  borderWidth: 2
                },
                label: {
                  show: true,
                  formatter: ( item ) =>{
                    return `${item.name}\n\n${item.value}`;
                  },
                  position: 'inner',
                },
                emphasis: {
                  label: {
                    show: true,
                    fontSize: 20,
                    fontWeight: 'bold'
                  }
                },
                labelLine: { 
                  show: true
                },
                data: [
                    { name: "CT", value: player['CT #']},
                    { name: "T", value: player['T #']},
                    // { name: "", value: player['CT #'] + player['T #'], 
                    //     itemStyle: { color: 'none'}, 
                    //     label: { show: false }
                    // },
                ],
              }
            ,
          };

    return (
        <ReactECharts option={defaultOptions} style={{height: "180px",width: "100%"}}/>
    )
}