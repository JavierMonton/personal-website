"use strict";(self.webpackChunkwebsite=self.webpackChunkwebsite||[]).push([[3415],{56190:(e,n,i)=>{i.r(n),i.d(n,{assets:()=>l,contentTitle:()=>r,default:()=>d,frontMatter:()=>s,metadata:()=>o,toc:()=>c});var t=i(85893),a=i(11151);const s={slug:"kafka-reassign-partitions",title:"Kafka - Reassign Partitions",authors:"javier",tags:["partitions","kafka-binaries","MSK"]},r="Kafka - Reassign Partitions & Brokers",o={permalink:"/blog/kafka-reassign-partitions",editUrl:"https://github.com/JavierMonton/blog/edit/main/website/blog/2024-10-06-kafka-reassign-partitions/index.md",source:"@site/blog/2024-10-06-kafka-reassign-partitions/index.md",title:"Kafka - Reassign Partitions",description:"When working with Kafka, increasing or decreasing the number of brokers isn't as trivial as it seems. If you add a new broker,",date:"2024-10-06T00:00:00.000Z",formattedDate:"October 6, 2024",tags:[{label:"partitions",permalink:"/blog/tags/partitions"},{label:"kafka-binaries",permalink:"/blog/tags/kafka-binaries"},{label:"MSK",permalink:"/blog/tags/msk"}],readingTime:3.515,hasTruncateMarker:!1,authors:[{name:"Javier Mont\xf3n",title:"Software Engineer",url:"https://github.com/JavierMonton",imageURL:"https://github.com/JavierMonton.png",key:"javier"}],frontMatter:{slug:"kafka-reassign-partitions",title:"Kafka - Reassign Partitions",authors:"javier",tags:["partitions","kafka-binaries","MSK"]},unlisted:!1,nextItem:{title:"Kafka Connect, MM2, and Offset Management",permalink:"/blog/kafka-connect-mm2-offset-management"}},l={authorsImageUrls:[void 0]},c=[{value:"Problem with Kafka Reassign tool",id:"problem-with-kafka-reassign-tool",level:2},{value:"Building a custom reassign plan.",id:"building-a-custom-reassign-plan",level:2}];function h(e){const n={admonition:"admonition",code:"code",h1:"h1",h2:"h2",img:"img",li:"li",p:"p",pre:"pre",ul:"ul",...(0,a.a)(),...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.p,{children:"When working with Kafka, increasing or decreasing the number of brokers isn't as trivial as it seems. If you add a new broker,\nit will stand there doing nothing. You have to manually reassign partitions of your topics to the new broker.\nBut you don't want to just move some topics completely to your new broker, you want to spread your partitions are they replicas equitably across all your brokers.\nYou also want to have the number of leader partitions balanced across all your brokers."}),"\n",(0,t.jsx)(n.h1,{id:"reassign-partitions",children:"Reassign partitions"}),"\n",(0,t.jsxs)(n.p,{children:["To reassign partitions to different brokers, you can use the Kafka binaries (",(0,t.jsx)(n.code,{children:"bin/kafka-reassign-partitions.sh"}),"),\nbut it isn't trivial if you have to reassign thousands of topics."]}),"\n",(0,t.jsx)(n.p,{children:"The binary file has three operations:"}),"\n",(0,t.jsxs)(n.ul,{children:["\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.code,{children:"--generate"}),". This will generate a plan to reassign partitions."]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.code,{children:"--execute"}),". This will execute the plan."]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.code,{children:"--verify"}),". This will verify the status of the reassignment."]}),"\n"]}),"\n",(0,t.jsx)(n.admonition,{type:"tip",children:(0,t.jsxs)(n.p,{children:["A throttle can be set to avoid overloading the brokers, and the throttle will remain in the cluster after the reassignment,\nuntil a ",(0,t.jsx)(n.code,{children:"--verify"})," is run when the reassignment has finished, so it's highly recommended to run ",(0,t.jsx)(n.code,{children:"--verify"}),"\nuntil you are sure all the partitions have been reassigned."]})}),"\n",(0,t.jsx)(n.p,{children:"To create a plan, you have to pass a JSON file with the topics you want to reassign and the brokers you want to reassign them to.\ne.g.:"}),"\n",(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{className:"language-json",children:'{\n  "topics": [\n    { "topic": "foo1" },\n    { "topic": "foo2" }\n  ],\n  "version": 1\n}\n'})}),"\n",(0,t.jsx)(n.p,{children:"And it will generate you a file like this:"}),"\n",(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{className:"language-json",children:'{"version":1,\n  "partitions":[{"topic":"foo1","partition":0,"replicas":[2,1],"log_dirs":["any"]},\n    {"topic":"foo1","partition":1,"replicas":[1,3],"log_dirs":["any"]},\n    {"topic":"foo1","partition":2,"replicas":[3,4],"log_dirs":["any"]},\n    {"topic":"foo2","partition":0,"replicas":[4,2],"log_dirs":["any"]},\n    {"topic":"foo2","partition":1,"replicas":[2,1],"log_dirs":["any"]},\n    {"topic":"foo2","partition":2,"replicas":[1,3],"log_dirs":["any"]}]\n}\n'})}),"\n",(0,t.jsx)(n.p,{children:"The input expects you to give the list of brokers (1,2,3,4,5...) and this JSON with the whole list of partitions and replicas."}),"\n",(0,t.jsx)(n.admonition,{type:"warning",children:(0,t.jsxs)(n.p,{children:["The first number in ",(0,t.jsx)(n.code,{children:'"replicas":[1,3]'})," is the leader partition, the rest are the followers.\nThis is very important because you might end up with more leader partitions in a broker than others, increasing its workload"]})}),"\n",(0,t.jsx)(n.h2,{id:"problem-with-kafka-reassign-tool",children:"Problem with Kafka Reassign tool"}),"\n",(0,t.jsxs)(n.p,{children:["When you need to reassign a big cluster, you might find some issues with the ",(0,t.jsx)(n.code,{children:"--generate"})," command:"]}),"\n",(0,t.jsxs)(n.ul,{children:["\n",(0,t.jsx)(n.li,{children:"The plan generated is completely random. Running it twice for a topic will produce different results."}),"\n",(0,t.jsx)(n.li,{children:"The plan generated is not always optimal. It might assign more partitions to one broker than to another."}),"\n"]}),"\n",(0,t.jsxs)(n.p,{children:["On a cluster with thousands of partitions this might be ok, as probably randomizing the partitions will be enough to balance them across the brokers,\nbut it might not be completely optional.\nAlso, if you need to run this for a lot of topics, and you want to do it on batches, you don't want to run the ",(0,t.jsx)(n.code,{children:"--generate"})," command for a topic twice,\nin that case, you will be reassigning a topic that was already reassigned."]}),"\n",(0,t.jsx)(n.h2,{id:"building-a-custom-reassign-plan",children:"Building a custom reassign plan."}),"\n",(0,t.jsx)(n.p,{children:"To manage partitions more properly, a custom tool can be built, where partitions are defined based on the topic name and the list of brokers.\nBy doing this, reassigning partitions on the same topic twice won't produce any changes. A tool like that can be used to manage the reassignment of partitions in a more controlled way."}),"\n",(0,t.jsx)(n.h1,{id:"balance-leader-partitions",children:"Balance Leader partitions"}),"\n",(0,t.jsxs)(n.p,{children:["After reassigning a lot of partitions, the leader partitions might not be well-balanced across your brokers.\nThis means that a broker might have more leader partitions than other brokers, which is translated into more workload.\nAn example in Kafka-UI:\n",(0,t.jsx)(n.img,{alt:"img.png",src:i(45283).Z+"",width:"415",height:"275"})]}),"\n",(0,t.jsxs)(n.p,{children:["If you wait, the cluster probably will rebalance the leader partitions on its own (if ",(0,t.jsx)(n.code,{children:"auto.leader.rebalance.enable=true"})," is set)."]}),"\n",(0,t.jsxs)(n.p,{children:["In order to force a rebalance, you can use the ",(0,t.jsx)(n.code,{children:"bin/kafka-leader-election.sh"})," binary."]}),"\n",(0,t.jsxs)(n.p,{children:["This an example of the CPU usage of brokers before and after the leader election:\n",(0,t.jsx)(n.img,{alt:"img.png",src:i(17348).Z+"",width:"572",height:"200"})]}),"\n",(0,t.jsx)(n.p,{children:"e.g.:"}),"\n",(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{className:"language-shell",children:"$ bin/kafka-leader-election.sh --bootstrap-server localhost:9092 --election-type preferred --all-topic-partitions\n"})}),"\n",(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.code,{children:"--election-type"})," can be ",(0,t.jsx)(n.code,{children:"preferred"})," or ",(0,t.jsx)(n.code,{children:"unclean"}),". ",(0,t.jsx)(n.code,{children:"preferred"})," will try to move the leader partition to the preferred broker, ",(0,t.jsx)(n.code,{children:"unclean"})," will move the leader partition to any broker."]}),"\n",(0,t.jsx)(n.h1,{id:"tldr",children:"TL;DR"}),"\n",(0,t.jsx)(n.p,{children:"To reassign partitions to new brokers:"}),"\n",(0,t.jsxs)(n.ul,{children:["\n",(0,t.jsxs)(n.li,{children:["Use the ",(0,t.jsx)(n.code,{children:"bin/kafka-reassign-partitions.sh"})," with a list of topics, brokers and the ",(0,t.jsx)(n.code,{children:"--generate"})," command."]}),"\n",(0,t.jsxs)(n.li,{children:["Use the ",(0,t.jsx)(n.code,{children:"bin/kafka-reassign-partitions.sh"})," with the generated JSON and the ",(0,t.jsx)(n.code,{children:"--execute"})," command."]}),"\n",(0,t.jsxs)(n.li,{children:["Use the ",(0,t.jsx)(n.code,{children:"bin/kafka-reassign-partitions.sh"})," with the generated JSON and the ",(0,t.jsx)(n.code,{children:"--verify"})," command."]}),"\n",(0,t.jsxs)(n.li,{children:["Use the ",(0,t.jsx)(n.code,{children:"bin/kafka-leader-election.sh"})," to balance the leader partitions across your brokers."]}),"\n"]})]})}function d(e={}){const{wrapper:n}={...(0,a.a)(),...e.components};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(h,{...e})}):h(e)}},17348:(e,n,i)=>{i.d(n,{Z:()=>t});const t=i.p+"assets/images/cpu-4cb1359a52de8e913d080e59e959eb0c.png"},45283:(e,n,i)=>{i.d(n,{Z:()=>t});const t=i.p+"assets/images/unbalanced-leaders-948b4ab9ea0f891749fb184e165e8d59.png"},11151:(e,n,i)=>{i.d(n,{Z:()=>o,a:()=>r});var t=i(67294);const a={},s=t.createContext(a);function r(e){const n=t.useContext(s);return t.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function o(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(a):e.components||a:r(e.components),t.createElement(s.Provider,{value:n},e.children)}}}]);