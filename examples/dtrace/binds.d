ldapjs*::bind:entry
{
  /*self->start = timestamp;*/
}
ldapjs*:::return
{
  /*
    /self->start/
    @ = quantize(timestamp - self->start);
    self->start = 0;"
  */
}
