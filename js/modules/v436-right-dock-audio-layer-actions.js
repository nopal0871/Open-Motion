(()=>{
  // V4.41 — right-dock ownership moved into TransportGeometryController.
  // Keep this legacy hook inert except for one startup scheduling request.
  window.omsTransportGeometryController?.schedule('right-dock-ready');
})();
