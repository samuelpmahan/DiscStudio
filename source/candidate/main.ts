import { mount } from 'svelte';
import './shared-shim.js';
import { defaultChecklist } from '../../public/shared/checklist-data.js';
import CandidateApp from './CandidateApp.svelte';

document
	.querySelector('tick-part-checklist')
	?.setAttribute('data-checklist', JSON.stringify(defaultChecklist));

mount(CandidateApp, { target: document.getElementById('app')! });
