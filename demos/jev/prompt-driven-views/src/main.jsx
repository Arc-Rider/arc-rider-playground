import React from 'react';
import {createRoot} from 'react-dom/client';
import MinimalTableLive from './MinimalTableLive.jsx';
import SmartKanbanLive from './SmartKanbanLive.jsx';
import './base.css';

const path=window.location.pathname.replace(/\/$/,'')||'/';
const view=path==='/'||path==='/minimal-table-live'||path==='/live'||path==='/view-switcher'
  ? <MinimalTableLive/>
  : path==='/smart-kanban-live'||path==='/kanban'
    ? <SmartKanbanLive/>
    : <main className="not-found"><h1>Demo not found</h1><p>Explore <a href="/minimal-table-live">Board ↔ Table</a> or <a href="/smart-kanban-live">Smart Kanban</a>.</p></main>;

createRoot(document.getElementById('root')).render(view);
