package com.example;

final class ReservationController {
  private final ReservationRepository repository;
  private final ReservationService service;

  ReservationController(ReservationRepository repository, ReservationService service) {
    this.repository = repository;
    this.service = service;
  }

  String listReservations() {
    service.prepareRead();
    return repository.findAll();
  }
}
