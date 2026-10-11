import {useEffect,useRef,useState,type ReactNode} from 'react';
import DashboardCockpit from './DashboardCockpit';
import RevenueMission from './RevenueMission';
import {HomeFlowMap,HomeOutputDoors} from './HomeFlowSurfaces';
import {homeRegionOrder,type HomeDesignConfig,type HomeRegion} from '../../data/homeDesignCombinations';
import '../../styles/dashboard-home-content.css';
import '../../styles/dashboard-home-presets.css';

// The preview shares the real Home components and read paths. It cannot save or publish.
export default function HomeDesignPreview({config}:{config:HomeDesignConfig}){
  const root=useRef<HTMLDivElement>(null);
  const [narrow,setNarrow]=useState(true);
  useEffect(()=>{
    if(!root.current)return;
    const observer=new ResizeObserver(([entry])=>setNarrow(entry.contentRect.width<860));
    observer.observe(root.current);return ()=>observer.disconnect();
  },[]);
  const regions:Record<HomeRegion,ReactNode>={
    cockpit:<DashboardCockpit readOnly/>,revenue:<RevenueMission readOnly/>,
    flow:<HomeFlowMap/>,output:<HomeOutputDoors/>,
  };
  return <div ref={root} id="dashboard-home-shell" className="dash-shell studio-home-preview"
    data-home-preset={config.style} data-home-layout={config.layout}
    data-home-buttons={config.buttons} data-home-cards={config.cards}
    data-home-navigation={config.navigation} data-home-cta={config.cta}>
    <div inert>
      <nav className="home-quick-nav" aria-label="ホームのクイックナビ">
        <a href="/dashboard/tasks">Task Flow</a><a href="/dashboard/line">LINE</a><a href="/dashboard/ace-assets">ACE Assets</a><a href="/mind?action=capture">Capture</a>
      </nav>
      <div className="home-layout-grid">{homeRegionOrder(config.layout,narrow).map(region=><div key={region} className={'home-unit home-unit--'+region}>{regions[region]}</div>)}</div>
    </div>
  </div>;
}
