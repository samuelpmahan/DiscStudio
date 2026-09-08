import { mount } from 'svelte';
import '../../public/shared/tick-part-checklist.js';
import { defaultChecklist } from '../../public/shared/checklist-data.js';
import DiscStudio from '../disc-studio/DiscStudio.svelte';

document
	.querySelector('tick-part-checklist')
	?.setAttribute('data-checklist', JSON.stringify(defaultChecklist));
mount(DiscStudio, { target: document.getElementById('app')! });
