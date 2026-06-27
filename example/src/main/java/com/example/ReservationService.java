package com.example;

final class ReservationService {
  private long idCounter;
  private final ReservationRepository repository;

  ReservationService(ReservationRepository repository) {
    this.repository = repository;
  }

  void prepareRead() {
    idCounter += repository.count();
  }
}
