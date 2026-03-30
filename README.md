# TOMRA-Synapse



## Overview 

We are developing a ML model serving & deploying platform that enables engineers to test and monitor ML models smoothly. To be specific, this platform focuses on image classification models and will allow engineers to deploy new model versions, deploy new models gradually instead of all-at-once (canary deployment), roll-back safely on edge devices, and monitor the performance of models in real-time. We will attempt to realize all these goals while keeping in mind Tomra's commitment to sustainability.

Our original draft can be found here: [Figma Dashboard Design](https://www.figma.com/make/hQlJ7WED5x9ZL3qS7EKHot/TOMRA-Synapse-Dashboard?fullscreen=1&t=PH6ggGKzuhDyDWw1-1)


## Our Client: Tomra 

Our client Tomra, is a Norwegian multinational technology company that specialises in systems for resource collection, sorting and optimisation, with a strong focus on recycling and sustainability. With their company brochure : Transforming how the world manages its resources, Tomra drives innovation worldwide and aims to enable a future without waste. 



## Our Team  

- **Nishit Jain (Team Lead)**  
- **Robin Schulz (Frontend Lead)**  
- **Chuan Zhao (Backend Lead)**  
- **Xinyi He (Frontend Dev)**  
- **Ben Murphy (Frontend Dev)**  
- **James Kearns (Backend & Devops)**  
- **Thomas Kennedy (Backend Dev)**  
- **Sinclair Philandrianos (Backend Dev)**  

## How to run the project
checkout to the develop branch on gitlab and pull the code in. If working with gitlab using terminal here are the commands:

root folder directory:
```
git fetch origin
git checkout develop
git pull origin develop
```
change directory and run backend
```
cd backend
mvn spring-boot:run
```
run frontend
```
cd frontend
npm install
npm run dev
```
run classification engine
```
cd classification-engine
python -m venv/venv
source venv/bin/activate
python test_client.py --folder app/TestImages
```